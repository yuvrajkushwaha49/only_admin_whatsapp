import fs from 'fs';
import { executeQuery, isUsingFallback, getMemoryStore } from '../database/db.js';
import { normalizePhone } from '../utils/phone.js';
import { iterateRowsStream } from '../utils/streamingFileParser.js';
import importQueue from '../queues/importQueue.js';
import { emitToTenant } from '../socket.js';
import logger from '../utils/logger.js';

const BATCH_SIZE = parseInt(process.env.IMPORT_BATCH_SIZE || '500', 10);

async function checkImportJobStatus(jobId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const j = store.import_jobs?.find(job => job.id === Number(jobId));
    return j ? j.status : null;
  }
  const rows = await executeQuery('SELECT status FROM import_jobs WHERE id = ? LIMIT 1', [jobId]);
  return rows.length > 0 ? rows[0].status : null;
}

/**
 * Process entire import job in streaming batches of 500
 */
export async function processImportJob(job) {
  const jobId = job.id;
  const businessId = Number(job.business_id);
  let filePath = job.file_path;
  if (!filePath || !fs.existsSync(filePath)) {
    const filename = path.basename(filePath ? filePath.replace(/\\/g, '/') : '');
    const candidatePaths = [
      filePath,
      path.resolve(process.cwd(), 'uploads', 'imports', filename),
      path.resolve(process.cwd(), 'backend', 'uploads', 'imports', filename),
      path.resolve('/var/www/campaignflow/backend/uploads/imports', filename),
      path.resolve('/var/www/campaignflow/uploads/imports', filename),
      path.resolve(process.cwd(), '..', 'uploads', 'imports', filename)
    ].filter(Boolean);

    const found = candidatePaths.find(p => fs.existsSync(p));
    if (found) {
      filePath = found;
    }
  }
  const fileType = job.file_type || 'csv';
  const columnMapping = typeof job.column_mapping === 'string' ? JSON.parse(job.column_mapping) : (job.column_mapping || {});
  const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options || {});

  const phoneCol = columnMapping.phone;
  const nameCol = columnMapping.name;
  const emailCol = columnMapping.email;
  const tagCol = columnMapping.tag;
  const consentCol = columnMapping.consent;

  const batchTag = options.batchTag ? String(options.batchTag).trim() : '';
  const groupId = options.groupId ? Number(options.groupId) : null;
  const defaultCountryCode = options.defaultCountryCode || '91';
  const consentSource = options.consentSource || 'csv_verified_records';

  logger.info(`⚡ [BatchProcessor] Starting streaming execution for Job #${jobId} (Tenant: ${businessId}, Batch Size: ${BATCH_SIZE})`);

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Import file not found on disk at: ${filePath || 'N/A'}`);
  }

  // Pre-load or cache tags for tenant
  const tagCache = new Map();
  if (!isUsingFallback()) {
    try {
      const tagRows = await executeQuery('SELECT id, name FROM tags WHERE business_id = ?', [businessId]);
      for (const t of tagRows) {
        tagCache.set(String(t.name).toLowerCase(), t.id);
      }
    } catch (err) {
      logger.warn(`[BatchProcessor] Pre-fetch tags warning: ${err.message}`);
    }
  }

  // Helper to ensure tag exists and return ID
  const getOrCreateTagId = async (tagName) => {
    const clean = String(tagName).trim();
    if (!clean) return null;
    const lower = clean.toLowerCase();

    if (isUsingFallback()) {
      const store = getMemoryStore();
      if (!store.tags) store.tags = [];
      let tagRecord = store.tags.find(t => t.business_id === businessId && t.name.toLowerCase() === lower);
      if (!tagRecord) {
        tagRecord = { id: store.tags.length + 1, business_id: businessId, name: clean, color: '#0d6efd', created_at: new Date() };
        store.tags.push(tagRecord);
      }
      return tagRecord.id;
    }

    if (tagCache.has(lower)) {
      return tagCache.get(lower);
    }

    const res = await executeQuery('INSERT INTO tags (business_id, name) VALUES (?, ?)', [businessId, clean]);
    const newId = res.insertId;
    tagCache.set(lower, newId);
    return newId;
  };

  // Pre-resolve batch tag IDs
  const batchTagIds = [];
  if (batchTag) {
    const splitTags = batchTag.split(',').map(t => t.trim()).filter(Boolean);
    for (const st of splitTags) {
      const tId = await getOrCreateTagId(st);
      if (tId) batchTagIds.push(tId);
    }
  }

  const seenPhonesInFile = new Set();
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalDuplicates = 0;
  let totalFailed = 0;

  let currentBatch = [];

  // Stream rows directly from disk (CSV or XLSX)
  for await (const rowItem of iterateRowsStream(filePath, fileType, columnMapping)) {
    currentBatch.push(rowItem);

    if (currentBatch.length >= BATCH_SIZE) {
      // Check if job was cancelled
      const currentStatus = await checkImportJobStatus(jobId);
      if (currentStatus === 'cancelled') {
        logger.info(`🛑 [BatchProcessor] Job #${jobId} was cancelled by user. Halting execution.`);
        return { jobId, status: 'cancelled', stopped: true };
      }

      const stats = await processBatch({
        batch: currentBatch,
        businessId,
        jobId,
        fileName: job.file_name,
        phoneCol,
        nameCol,
        emailCol,
        tagCol,
        consentCol,
        defaultCountryCode,
        consentSource,
        batchTagIds,
        groupId,
        seenPhonesInFile,
        getOrCreateTagId,
        options
      });

      totalProcessed += currentBatch.length;
      totalSuccessful += stats.successful;
      totalDuplicates += stats.duplicates;
      totalFailed += stats.failed;

      // Update progress in database
      await importQueue.updateJobProgress(jobId, {
        processedRows: totalProcessed,
        successfulRows: totalSuccessful,
        failedRows: totalFailed,
        duplicateRows: totalDuplicates
      });

      currentBatch = [];
    }
  }

  // Process remaining items in last batch
  if (currentBatch.length > 0) {
    const currentStatus = await checkImportJobStatus(jobId);
    if (currentStatus === 'cancelled') {
      logger.info(`🛑 [BatchProcessor] Job #${jobId} was cancelled by user before final batch.`);
      return { jobId, status: 'cancelled', stopped: true };
    }

    const stats = await processBatch({
      batch: currentBatch,
      businessId,
      jobId,
      fileName: job.file_name,
      phoneCol,
      nameCol,
      emailCol,
      tagCol,
      consentCol,
      defaultCountryCode,
      consentSource,
      batchTagIds,
      groupId,
      seenPhonesInFile,
      getOrCreateTagId,
      options
    });

    totalProcessed += currentBatch.length;
    totalSuccessful += stats.successful;
    totalDuplicates += stats.duplicates;
    totalFailed += stats.failed;

    const totalRowsCount = Number(job.total_rows || totalProcessed);
    const percent = Math.min(100, Math.round((totalProcessed / (totalRowsCount || 1)) * 100));

    emitToTenant(businessId, 'import:progress', {
      jobId,
      fileName: job.file_name,
      processedRows: totalProcessed,
      successfulRows: totalSuccessful,
      duplicateRows: totalDuplicates,
      failedRows: totalFailed,
      totalRows: totalRowsCount,
      remainingRows: Math.max(0, totalRowsCount - totalProcessed),
      percent,
      status: 'processing'
    });
  }

  // Mark job completed
  await importQueue.markJobCompleted(jobId, {
    totalRows: totalProcessed,
    successfulRows: totalSuccessful,
    failedRows: totalFailed,
    duplicateRows: totalDuplicates
  });

  emitToTenant(businessId, 'import:status_update', {
    jobId,
    fileName: job.file_name,
    status: 'completed',
    successfulRows: totalSuccessful,
    totalRows: totalProcessed,
    percent: 100
  });

  logger.info(`🏁 [BatchProcessor] Completed Job #${jobId}: ${totalSuccessful} imported, ${totalDuplicates} duplicates, ${totalFailed} failed.`);

  // Cleanup temporary file if retention not explicitly enabled
  const shouldRetain = process.env.IMPORT_RETAIN_FILES === 'true';
  if (!shouldRetain && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      logger.info(`🧹 [BatchProcessor] Cleaned up temporary upload file: ${filePath}`);
    } catch (cleanErr) {
      logger.warn(`[BatchProcessor] File cleanup warning: ${cleanErr.message}`);
    }
  }

  return {
    jobId,
    totalRows: totalProcessed,
    successful: totalSuccessful,
    duplicates: totalDuplicates,
    failed: totalFailed
  };
}

/**
 * Process a single batch of up to 500 records with high-performance bulk operations
 */
async function processBatch({
  batch,
  businessId,
  jobId,
  fileName,
  phoneCol,
  nameCol,
  emailCol,
  tagCol,
  consentCol,
  defaultCountryCode,
  consentSource,
  batchTagIds,
  groupId,
  seenPhonesInFile,
  getOrCreateTagId,
  options = {}
}) {
  let successful = 0;
  let duplicates = 0;
  let failed = 0;

  const validRows = [];
  const errorReports = [];
  const candidatePhones = [];

  // Phase A: In-memory normalization and intra-file deduplication
  for (const item of batch) {
    const rowNum = item.rowNumber;
    const row = item.data;
    const rawPhone = row[phoneCol];
    const name = nameCol && row[nameCol] ? String(row[nameCol]).trim() : null;
    const email = emailCol && row[emailCol] ? String(row[emailCol]).trim() : null;
    const rowTag = tagCol && row[tagCol] ? String(row[tagCol]).trim() : null;

    // Check if the entire row has no phone and no other identifying contact fields (ghost/blank row)
    const hasAnyFieldContent = (rawPhone !== undefined && rawPhone !== null && String(rawPhone).trim() !== '') ||
      (name && name !== '') ||
      (email && email !== '') ||
      (rowTag && rowTag !== '');

    if (!hasAnyFieldContent) {
      // Completely empty / blank row (e.g. ghost rows from Excel empty cells) - skip silently without failing
      continue;
    }

    // 1. Phone validation & normalization
    const norm = normalizePhone(rawPhone, defaultCountryCode);
    if (!norm.isValid) {
      failed++;
      errorReports.push({
        job_id: jobId,
        row_number: rowNum,
        phone: rawPhone ? String(rawPhone).substring(0, 32) : 'EMPTY',
        status: 'failed',
        error_reason: norm.error
      });
      continue;
    }

    const phone = norm.phone;

    // 2. Intra-file duplicate check:
    // If skipDuplicates is explicitly true (legacy test mode), skip it.
    // Otherwise, do NOT skip duplicates — allow them to update tags and fields!
    if (seenPhonesInFile.has(phone) && options.skipDuplicates === true) {
      duplicates++;
      errorReports.push({
        job_id: jobId,
        row_number: rowNum,
        phone,
        status: 'skipped',
        error_reason: 'Duplicate phone within the same import file'
      });
      continue;
    }
    seenPhonesInFile.add(phone);

    // 3. Consent check:
    // By default, since user verifies batch consent on upload, all valid phone numbers are imported.
    // If strictConsent is explicitly enabled, reject rows marked 'no'/'opted_out'.
    // Otherwise, import them with is_opted_in: 0 so the business has the record and it is NOT failed.
    let isOptedIn = 1;
    let consentStatus = 'opted_in';
    let isExplicitOptOut = false;

    if (consentCol && row[consentCol] !== undefined && row[consentCol] !== null && String(row[consentCol]).trim() !== '') {
      const rawVal = String(row[consentCol]).toLowerCase().trim();
      if (rawVal === 'no' || rawVal === 'false' || rawVal === '0' || rawVal === 'opted_out' || rawVal === 'unsubscribed' || rawVal === 'rejected') {
        isExplicitOptOut = true;
        isOptedIn = 0;
        consentStatus = 'opted_out';
      }
    }

    if (isExplicitOptOut && options.strictConsent === true) {
      failed++;
      errorReports.push({
        job_id: jobId,
        row_number: rowNum,
        phone,
        status: 'failed',
        error_reason: 'Explicitly marked as opt-out/no in CSV consent column'
      });
      continue;
    }

    candidatePhones.push(phone);
    validRows.push({
      rowNum,
      phone,
      name,
      email,
      rowTag,
      isOptedIn,
      consentStatus
    });
  }

  if (validRows.length === 0) {
    // Save any errors from this batch
    await saveErrorReports(errorReports);
    return { successful, duplicates, failed };
  }

  // Phase B: Single batch query to check existing contacts in DB for candidate phones
  const existingMap = new Map();
  if (isUsingFallback()) {
    const store = getMemoryStore();
    for (const c of (store.contacts || [])) {
      if (c.business_id === businessId && candidatePhones.includes(c.phone)) {
        existingMap.set(c.phone, c);
      }
    }
  } else {
    const placeholders = candidatePhones.map(() => '?').join(',');
    const rows = await executeQuery(
      `SELECT id, phone, status, is_opted_in, name, email FROM contacts WHERE business_id = ? AND phone IN (${placeholders})`,
      [businessId, ...candidatePhones]
    );
    for (const r of rows) {
      existingMap.set(r.phone, r);
    }
  }

  // Phase C: Separate new contacts vs existing contacts
  const newContactsToInsert = [];
  const existingContactsToUpdate = [];
  const contactsForRelations = []; // { contactId, phone, rowTag }
  const intraBatchRepeats = []; // For contacts repeated within the same 500-batch

  for (const vr of validRows) {
    const existing = existingMap.get(vr.phone);

    if (existing) {
      // Compliance check: If previously unsubscribed, preserve preference
      if (existing.status === 'unsubscribed' || Number(existing.is_opted_in) === 0) {
        if (options.skipDuplicates === true) {
          duplicates++;
          errorReports.push({
            job_id: jobId,
            row_number: vr.rowNum,
            phone: vr.phone,
            status: 'skipped',
            error_reason: 'Contact previously unsubscribed / opted out. Preserving unsubscribe preference.'
          });
          continue;
        } else {
          // Do not skip: attach new tags while keeping unsubscribed preference intact
          contactsForRelations.push({
            contactId: existing.id,
            phone: vr.phone,
            rowTag: vr.rowTag,
            isNew: false
          });
          successful++;
          continue;
        }
      }

      // Existing contact is active: update tags and optional name/email
      if (vr.name || vr.email) {
        existingContactsToUpdate.push({
          id: existing.id,
          name: vr.name,
          email: vr.email
        });
      }

      contactsForRelations.push({
        contactId: existing.id,
        phone: vr.phone,
        rowTag: vr.rowTag,
        isNew: false
      });

      successful++;
    } else {
      // Check if this phone was already queued for new insert in this very batch
      const alreadyQueued = newContactsToInsert.find(nc => nc.phone === vr.phone);
      if (alreadyQueued) {
        // Intra-batch repeat: update tags once new contact is created
        intraBatchRepeats.push({
          phone: vr.phone,
          rowTag: vr.rowTag,
          name: vr.name,
          email: vr.email
        });
        successful++;
      } else {
        // Brand new contact
        newContactsToInsert.push({
          rowNum: vr.rowNum,
          phone: vr.phone,
          name: vr.name,
          email: vr.email,
          rowTag: vr.rowTag,
          isOptedIn: vr.isOptedIn ?? 1,
          consentStatus: vr.consentStatus || 'opted_in'
        });
      }
    }
  }

  // Phase D: Bulk insert brand new contacts
  if (newContactsToInsert.length > 0) {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      if (!store.contacts) store.contacts = [];
      for (const nc of newContactsToInsert) {
        const newId = store.contacts.length > 0 ? Math.max(...store.contacts.map(c => c.id || 0)) + 1 : 1;
        store.contacts.push({
          id: newId,
          business_id: businessId,
          phone: nc.phone,
          country_code: defaultCountryCode,
          name: nc.name,
          email: nc.email,
          is_opted_in: nc.isOptedIn,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });

        contactsForRelations.push({
          contactId: newId,
          phone: nc.phone,
          rowTag: nc.rowTag,
          isNew: true,
          rowNum: nc.rowNum,
          consentStatus: nc.consentStatus
        });
        successful++;
      }

      // Attach tags for intra-batch repeats in fallback mode
      for (const rep of intraBatchRepeats) {
        const c = store.contacts.find(x => x.business_id === businessId && x.phone === rep.phone);
        if (c) {
          contactsForRelations.push({
            contactId: c.id,
            phone: rep.phone,
            rowTag: rep.rowTag,
            isNew: false
          });
        }
      }
    } else {
      // Multi-row INSERT into contacts
      const insertPlaceholders = newContactsToInsert.map(() => '(?, ?, ?, ?, ?, ?, \'active\', NOW(), NOW())').join(', ');
      const insertValues = [];
      for (const nc of newContactsToInsert) {
        insertValues.push(businessId, nc.phone, defaultCountryCode, nc.name || null, nc.email || null, nc.isOptedIn);
      }

      await executeQuery(
        `INSERT INTO contacts (business_id, phone, country_code, name, email, is_opted_in, status, created_at, updated_at)
         VALUES ${insertPlaceholders}
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        insertValues
      );

      // Fetch IDs of newly created contacts
      const newPhones = newContactsToInsert.map(x => x.phone);
      const phonePlaceholders = newPhones.map(() => '?').join(',');
      const insertedRows = await executeQuery(
        `SELECT id, phone FROM contacts WHERE business_id = ? AND phone IN (${phonePlaceholders})`,
        [businessId, ...newPhones]
      );

      const insertedIdMap = new Map();
      for (const ir of insertedRows) {
        insertedIdMap.set(ir.phone, ir.id);
      }

      for (const nc of newContactsToInsert) {
        const cId = insertedIdMap.get(nc.phone);
        if (cId) {
          contactsForRelations.push({
            contactId: cId,
            phone: nc.phone,
            rowTag: nc.rowTag,
            isNew: true,
            rowNum: nc.rowNum,
            consentStatus: nc.consentStatus
          });
        }
        successful++;
      }

      // Also attach tags for intra-batch repeats
      for (const rep of intraBatchRepeats) {
        const cId = insertedIdMap.get(rep.phone);
        if (cId) {
          contactsForRelations.push({
            contactId: cId,
            phone: rep.phone,
            rowTag: rep.rowTag,
            isNew: false
          });
        }
      }
    }
  }

  // Phase E: Bulk update existing contacts (only non-null fields)
  if (existingContactsToUpdate.length > 0) {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      for (const ec of existingContactsToUpdate) {
        const c = store.contacts?.find(x => x.id === ec.id);
        if (c) {
          if (ec.name) c.name = ec.name;
          if (ec.email) c.email = ec.email;
        }
      }
    } else {
      for (const ec of existingContactsToUpdate) {
        if (ec.name || ec.email) {
          await executeQuery(
            `UPDATE contacts SET name = COALESCE(?, name), email = COALESCE(?, email), updated_at = NOW() WHERE id = ? AND business_id = ?`,
            [ec.name || null, ec.email || null, ec.id, businessId]
          ).catch(() => {});
        }
      }
    }
  }

  // Phase F: Bulk insert consents for newly inserted contacts
  const newRelations = contactsForRelations.filter(r => r.isNew);
  if (newRelations.length > 0) {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      if (!store.contact_consents) store.contact_consents = [];
      for (const nr of newRelations) {
        store.contact_consents.push({
          id: store.contact_consents.length + 1,
          business_id: businessId,
          contact_id: nr.contactId,
          consent_status: nr.consentStatus || 'opted_in',
          consent_source: consentSource,
          consent_category: 'promotional',
          proof_notes: `Job #${jobId} | Batch Import: ${fileName}, Row #${nr.rowNum}`,
          created_at: new Date()
        });
      }
    } else {
      const consentPlaceholders = newRelations.map(() => '(?, ?, ?, ?, \'promotional\', ?, NOW())').join(', ');
      const consentValues = [];
      for (const nr of newRelations) {
        consentValues.push(businessId, nr.contactId, nr.consentStatus || 'opted_in', consentSource, `Job #${jobId} | Batch Import: ${fileName}, Row #${nr.rowNum}`);
      }
      await executeQuery(
        `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes, created_at)
         VALUES ${consentPlaceholders}`,
        consentValues
      ).catch(e => logger.warn(`[BatchProcessor] Consent insert warning: ${e.message}`));
    }
  }

  // Phase G: Bulk insert contact tags (Batch tags + Row tags)
  const contactTagPairs = [];
  for (const cr of contactsForRelations) {
    // Add batch tags
    for (const btId of batchTagIds) {
      contactTagPairs.push([businessId, cr.contactId, btId]);
    }
    // Add row tag if present
    if (cr.rowTag) {
      const rtId = await getOrCreateTagId(cr.rowTag);
      if (rtId && !batchTagIds.includes(rtId)) {
        contactTagPairs.push([businessId, cr.contactId, rtId]);
      }
    }
  }

  if (contactTagPairs.length > 0) {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      if (!store.contact_tags) store.contact_tags = [];
      for (const pair of contactTagPairs) {
        const already = store.contact_tags.some(ct => ct.business_id === pair[0] && ct.contact_id === pair[1] && ct.tag_id === pair[2]);
        if (!already) {
          store.contact_tags.push({ id: store.contact_tags.length + 1, business_id: pair[0], contact_id: pair[1], tag_id: pair[2] });
        }
      }
    } else {
      const tagPlaceholders = contactTagPairs.map(() => '(?, ?, ?, NOW())').join(', ');
      const tagValues = contactTagPairs.flat();
      await executeQuery(
        `INSERT IGNORE INTO contact_tags (business_id, contact_id, tag_id, created_at) VALUES ${tagPlaceholders}`,
        tagValues
      ).catch(() => {});
    }
  }

  // Phase H: Bulk insert contact group members if groupId specified
  if (groupId && contactsForRelations.length > 0) {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      if (!store.contact_group_members) store.contact_group_members = [];
      for (const cr of contactsForRelations) {
        const already = store.contact_group_members.some(m => m.business_id === businessId && m.group_id === groupId && m.contact_id === cr.contactId);
        if (!already) {
          store.contact_group_members.push({
            id: store.contact_group_members.length + 1,
            business_id: businessId,
            group_id: groupId,
            contact_id: cr.contactId,
            created_at: new Date()
          });
        }
      }
    } else {
      const groupPlaceholders = contactsForRelations.map(() => '(?, ?, ?, NOW())').join(', ');
      const groupValues = [];
      for (const cr of contactsForRelations) {
        groupValues.push(businessId, groupId, cr.contactId);
      }
      await executeQuery(
        `INSERT IGNORE INTO contact_group_members (business_id, group_id, contact_id, created_at) VALUES ${groupPlaceholders}`,
        groupValues
      ).catch(e => logger.warn(`[BatchProcessor] Group membership insert warning: ${e.message}`));
    }
  }

  // Phase I: Save error/skipped reports for audit trail
  await saveErrorReports(errorReports);

  return { successful, duplicates, failed };
}

/**
 * Bulk save error and skipped row reports to import_rows
 */
async function saveErrorReports(reports) {
  if (!reports || reports.length === 0) return;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.import_rows) store.import_rows = [];
    for (const r of reports) {
      store.import_rows.push({
        id: store.import_rows.length + 1,
        job_id: r.job_id,
        row_number: r.row_number,
        phone: r.phone,
        status: r.status,
        error_reason: r.error_reason,
        created_at: new Date()
      });
    }
    return;
  }

  // Multi-row INSERT into import_rows
  const placeholders = reports.map(() => '(?, ?, ?, ?, ?, NOW())').join(', ');
  const values = [];
  for (const r of reports) {
    values.push(r.job_id, r.row_number, r.phone || '', r.status, r.error_reason || '');
  }

  await executeQuery(
    `INSERT INTO import_rows (job_id, \`row_number\`, phone, status, error_reason, created_at) VALUES ${placeholders}`,
    values
  ).catch(err => {
    logger.warn(`[BatchProcessor] Failed saving row error reports: ${err.message}`);
  });
}

export default {
  processImportJob
};

