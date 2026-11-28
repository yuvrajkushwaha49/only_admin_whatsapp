import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as whatsappService from './whatsapp.service.js';

export async function getConnectConfig(req, res, next) {
  try {
    const config = await whatsappService.getConnectConfig(req.businessId);
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

export async function completeEmbeddedSignup(req, res, next) {
  try {
    const result = await whatsappService.completeEmbeddedSignup(req.businessId, req.body);
    res.status(201).json({
      success: true,
      message: 'Meta WhatsApp account connected and verified successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function connect(req, res, next) {
  try {
    const result = await whatsappService.connectAccount(req.businessId, req.body);
    res.status(201).json({ success: true, message: 'WhatsApp account connected successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function listAccounts(req, res, next) {
  try {
    const result = await whatsappService.listAccounts(req.businessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAccount(req, res, next) {
  try {
    const result = await whatsappService.getAccount(req.businessId, req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'WhatsApp Account not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function verifyAccount(req, res, next) {
  try {
    const result = await whatsappService.verifyAccount(req.businessId, req.params.id);
    res.json({ success: true, message: 'Account status refreshed from Meta', data: result });
  } catch (error) {
    next(error);
  }
}

export async function disconnectAccount(req, res, next) {
  try {
    const result = await whatsappService.disconnectAccount(req.businessId, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    const result = await whatsappService.deleteAccount(req.businessId, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function setPrimaryAccount(req, res, next) {
  try {
    const result = await whatsappService.setPrimaryAccount(req.businessId, req.params.id);
    res.json({
      success: true,
      message: 'Account set as primary default sender successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function listTemplates(req, res, next) {
  try {
    const result = await whatsappService.listTemplates(req.businessId, req.query);
    res.json({
      success: true,
      data: result.templates,
      stats: result.stats,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

export async function getTemplate(req, res, next) {
  try {
    const result = await whatsappService.getTemplate(req.businessId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function createTemplate(req, res, next) {
  try {
    const result = await whatsappService.createTemplate(req.businessId, req.user?.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Template submitted to Meta successfully for review',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadTemplateMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No media file uploaded.' } });
    }
    const filename = req.file.filename;
    const originalname = req.file.originalname;
    const ext = (originalname.split('.').pop() || '').toLowerCase();
    let format = 'IMAGE';
    if (ext === 'mp4') format = 'VIDEO';
    else if (ext === 'pdf') format = 'DOCUMENT';

    const fileUrl = `/uploads/templates/${filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        filename: originalname,
        format,
        size: req.file.size
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadTemplateMediaChunk(req, res, next) {
  try {
    const { uploadId, chunkIndex, totalChunks, originalName } = req.body;
    if (!uploadId || chunkIndex === undefined || !totalChunks || !originalName || !req.file) {
      return res.status(400).json({ success: false, error: { message: 'Missing chunk upload parameters or file.' } });
    }

    const cIndex = parseInt(chunkIndex, 10);
    const tChunks = parseInt(totalChunks, 10);
    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkDir = path.resolve(process.cwd(), 'uploads', 'chunks', safeUploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkDest = path.join(chunkDir, `chunk_${cIndex}`);
    try {
      fs.renameSync(req.file.path, chunkDest);
    } catch (_) {
      fs.copyFileSync(req.file.path, chunkDest);
      fs.unlinkSync(req.file.path);
    }

    // If more chunks remain
    if (cIndex < tChunks - 1) {
      return res.json({
        success: true,
        completed: false,
        chunkIndex: cIndex,
        totalChunks: tChunks,
        progress: Math.round(((cIndex + 1) / tChunks) * 100)
      });
    }

    // All chunks received, assemble final file!
    const ext = path.extname(originalName).toLowerCase();
    let format = 'IMAGE';
    if (ext === '.mp4') format = 'VIDEO';
    else if (ext === '.pdf') format = 'DOCUMENT';

    const finalFileName = `tpl-media-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    const finalDir = path.resolve(process.cwd(), 'uploads', 'templates');
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    const finalPath = path.join(finalDir, finalFileName);

    const writeStream = fs.createWriteStream(finalPath);
    for (let i = 0; i < tChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      if (fs.existsSync(chunkPath)) {
        const chunkBuf = fs.readFileSync(chunkPath);
        writeStream.write(chunkBuf);
      }
    }
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Cleanup chunk directory
    try {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    } catch (_) {}

    const stats = fs.statSync(finalPath);
    const fileUrl = `/uploads/templates/${finalFileName}`;

    res.json({
      success: true,
      completed: true,
      progress: 100,
      data: {
        url: fileUrl,
        filename: originalName,
        format,
        size: stats.size
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function syncTemplates(req, res, next) {
  try {
    const accountId = req.params.accountId || req.query.accountId;
    const result = await whatsappService.syncTemplates(req.businessId, accountId);
    res.json({
      success: true,
      message: `Successfully synchronized ${result.syncedCount || 0} templates from Meta`,
      data: result.templates,
      stats: result.stats
    });
  } catch (error) {
    next(error);
  }
}

export async function checkTemplateStatus(req, res, next) {
  try {
    const result = await whatsappService.checkTemplateStatus(req.businessId, req.params.id);
    res.json({
      success: true,
      message: 'Live template status retrieved from Meta',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    const result = await whatsappService.deleteTemplate(req.businessId, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function sendTestMessage(req, res, next) {
  try {
    const accountId = req.params.id || req.body.accountId || req.query.accountId;
    const result = await whatsappService.sendTestMessage(req.businessId, accountId, req.body);
    res.json({
      success: true,
      message: 'Test WhatsApp message sent successfully via Meta Cloud API!',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function testWebhookPing(req, res, next) {
  try {
    const result = await whatsappService.testWebhookPing(req.businessId);
    res.json({
      success: true,
      message: 'Webhook configuration active and ready to receive messages from Meta',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function detectMetaAccount(req, res, next) {
  try {
    const result = await whatsappService.detectMetaAccount(req.businessId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function autoConnectMetaAccount(req, res, next) {
  try {
    const result = await whatsappService.autoConnectMetaAccount(req.businessId, req.body);
    res.status(201).json({
      success: true,
      message: 'Meta WhatsApp Business Account connected and verified successfully!',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getWabaOnboardingInfo(req, res, next) {
  try {
    const wabaId = req.query.wabaId || null;
    const result = await whatsappService.getWabaOnboardingInfo(req.businessId, wabaId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function addPhoneNumberAndSendOtp(req, res, next) {
  try {
    const result = await whatsappService.addPhoneNumberAndRequestOtp(req.businessId, req.body);
    res.status(201).json({
      success: true,
      message: result.alreadyVerified
        ? 'Phone number is already verified on Meta! Click Finish to register & connect it.'
        : `Verification OTP sent via ${result.codeMethod} to ${result.fullPhoneNumber}.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function resendPhoneNumberOtp(req, res, next) {
  try {
    const result = await whatsappService.resendPhoneOtp(req.businessId, req.body);
    res.json({
      success: true,
      message: `OTP resent via ${result.codeMethod}.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPhoneNumberAndConnect(req, res, next) {
  try {
    const result = await whatsappService.verifyPhoneOtpAndConnect(req.businessId, req.body);
    res.status(201).json({
      success: true,
      message: `WhatsApp number ${result.phone_number} verified, registered, and connected successfully!`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getWabaBillingStatus(req, res, next) {
  try {
    const wabaId = req.query.wabaId || null;
    const result = await whatsappService.getWabaBillingStatus(req.businessId, wabaId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateAccountToken(req, res, next) {
  try {
    const accountId = req.params.id;
    const { accessToken, token } = req.body;
    const result = await whatsappService.updateAccountToken(req.businessId, accountId, accessToken || token);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  connect,
  listAccounts,
  getAccount,
  updateAccountToken,
  listTemplates,
  getTemplate,
  createTemplate,
  uploadTemplateMedia,
  uploadTemplateMediaChunk,
  syncTemplates,
  checkTemplateStatus,
  deleteTemplate,
  sendTestMessage,
  testWebhookPing,
  detectMetaAccount,
  autoConnectMetaAccount,
  getWabaOnboardingInfo,
  addPhoneNumberAndSendOtp,
  resendPhoneNumberOtp,
  verifyPhoneNumberAndConnect,
  getWabaBillingStatus
};
