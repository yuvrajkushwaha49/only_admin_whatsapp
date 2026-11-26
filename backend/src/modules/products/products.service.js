import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import logger from '../../utils/logger.js';
import { encodeHashId, decodeHashId } from '../../utils/hashId.js';

let tablesChecked = false;

/**
 * Self-healing schema: auto-create tables if migrations haven't run on host
 */
export async function ensureProductTables() {
  if (tablesChecked || isUsingFallback()) return;
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cat_business (business_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NULL,
        name VARCHAR(150) NOT NULL,
        sku VARCHAR(64) NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'INR',
        description TEXT NULL,
        image_url TEXT NULL,
        whatsapp_message_text TEXT NULL,
        stock_status ENUM('in_stock', 'low_stock', 'out_of_stock') DEFAULT 'in_stock',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prod_business (business_id, is_active),
        INDEX idx_prod_cat (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    tablesChecked = true;
    logger.info('[ProductsService] Auto-verified product_categories & products tables exist.');
  } catch (err) {
    logger.warn('[ProductsService] Table auto-creation notice:', err.message);
  }
}

function parseId(rawId) {
  if (!rawId) return null;
  const s = String(rawId).trim();
  if (/^\d+$/.test(s)) return Number(s);
  return decodeHashId(s);
}

/**
 * List products for tenant with filters & categories
 */
export async function getProducts(businessId, filters = {}) {
  const numBusinessId = Number(businessId) || 1;
  const { search = '', categoryId = 'ALL', stockStatus = 'ALL', limit = 50, offset = 0 } = filters;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.products) store.products = [];
    if (!store.product_categories) store.product_categories = [];

    let list = store.products.filter(p => Number(p.business_id) === numBusinessId);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (categoryId && categoryId !== 'ALL') {
      list = list.filter(p => String(p.category_id) === String(categoryId));
    }

    if (stockStatus && stockStatus !== 'ALL') {
      list = list.filter(p => p.stock_status === stockStatus);
    }

    const total = list.length;
    const paginated = list.slice(Number(offset), Number(offset) + Number(limit));

    return {
      products: paginated.map(p => {
        const cat = store.product_categories.find(c => Number(c.id) === Number(p.category_id));
        return {
          ...p,
          hashId: encodeHashId(p.id),
          category_name: cat?.name || 'Uncategorized'
        };
      }),
      pagination: { total, limit: Number(limit), offset: Number(offset) },
      stats: {
        totalProducts: store.products.filter(p => Number(p.business_id) === numBusinessId).length,
        inStockCount: store.products.filter(p => Number(p.business_id) === numBusinessId && p.stock_status === 'in_stock').length,
        categoriesCount: store.product_categories.filter(c => Number(c.business_id) === numBusinessId).length
      }
    };
  }

  // MySQL Implementation with self-healing schema
  await ensureProductTables();

  try {
    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.business_id = ?
    `;
    const params = [numBusinessId];

    if (search && search.trim()) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
      const wild = `%${search.trim()}%`;
      params.push(wild, wild, wild);
    }

    if (categoryId && categoryId !== 'ALL') {
      sql += ' AND p.category_id = ?';
      params.push(Number(categoryId));
    }

    if (stockStatus && stockStatus !== 'ALL') {
      sql += ' AND p.stock_status = ?';
      params.push(stockStatus);
    }

    sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = await executeQuery(sql, params);

    const [statsRow] = await executeQuery(`
      SELECT 
        COUNT(*) as totalProducts,
        SUM(CASE WHEN stock_status = 'in_stock' THEN 1 ELSE 0 END) as inStockCount
      FROM products
      WHERE business_id = ?
    `, [numBusinessId]);

    const [catCountRow] = await executeQuery(`
      SELECT COUNT(*) as categoriesCount
      FROM product_categories
      WHERE business_id = ?
    `, [numBusinessId]);

    return {
      products: (rows || []).map(r => ({
        ...r,
        hashId: encodeHashId(r.id)
      })),
      pagination: { total: Number(statsRow?.totalProducts || 0), limit: Number(limit), offset: Number(offset) },
      stats: {
        totalProducts: Number(statsRow?.totalProducts || 0),
        inStockCount: Number(statsRow?.inStockCount || 0),
        categoriesCount: Number(catCountRow?.categoriesCount || 0)
      }
    };
  } catch (err) {
    logger.error('[ProductsService] Error fetching products:', err.message);
    // If table didn't exist, retry once after force creating
    if (err.code === 'ER_NO_SUCH_TABLE') {
      tablesChecked = false;
      await ensureProductTables();
      return {
        products: [],
        pagination: { total: 0, limit: Number(limit), offset: Number(offset) },
        stats: { totalProducts: 0, inStockCount: 0, categoriesCount: 0 }
      };
    }
    throw err;
  }
}

export async function getProductById(businessId, rawId) {
  const numBusinessId = Number(businessId) || 1;
  const prodId = parseId(rawId);

  if (!prodId) {
    const err = new Error('Invalid product identifier');
    err.statusCode = 400;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const prod = (store.products || []).find(p => Number(p.id) === prodId && Number(p.business_id) === numBusinessId);
    if (!prod) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }
    const cat = (store.product_categories || []).find(c => Number(c.id) === Number(prod.category_id));
    return { ...prod, hashId: encodeHashId(prod.id), category_name: cat?.name || 'Uncategorized' };
  }

  await ensureProductTables();

  const rows = await executeQuery(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN product_categories c ON p.category_id = c.id
    WHERE p.id = ? AND p.business_id = ? LIMIT 1
  `, [prodId, numBusinessId]);

  if (!rows || rows.length === 0) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  return { ...rows[0], hashId: encodeHashId(rows[0].id) };
}

export async function createProduct(businessId, data = {}) {
  const numBusinessId = Number(businessId) || 1;
  const {
    name,
    sku = '',
    price = 0,
    currency = 'INR',
    categoryId = null,
    description = '',
    imageUrl = '',
    whatsappMessageText = '',
    stockStatus = 'in_stock'
  } = data;

  const cleanName = String(name || '').trim();
  if (!cleanName) {
    const err = new Error('Product name is required');
    err.statusCode = 400;
    throw err;
  }

  const numPrice = parseFloat(price) || 0;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.products) store.products = [];
    const newId = Date.now();
    const newProd = {
      id: newId,
      business_id: numBusinessId,
      category_id: categoryId ? Number(categoryId) : null,
      name: cleanName,
      sku: String(sku || '').trim(),
      price: numPrice,
      currency: currency || 'INR',
      description: description || '',
      image_url: imageUrl || '',
      whatsapp_message_text: whatsappMessageText || '',
      stock_status: stockStatus || 'in_stock',
      is_active: 1,
      created_at: new Date(),
      updated_at: new Date()
    };
    store.products.unshift(newProd);
    saveMemoryStore();
    return { ...newProd, hashId: encodeHashId(newProd.id) };
  }

  await ensureProductTables();

  const insert = await executeQuery(`
    INSERT INTO products 
      (business_id, category_id, name, sku, price, currency, description, image_url, whatsapp_message_text, stock_status, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
  `, [
    numBusinessId,
    categoryId ? Number(categoryId) : null,
    cleanName,
    String(sku || '').trim(),
    numPrice,
    currency || 'INR',
    description || '',
    imageUrl || '',
    whatsappMessageText || '',
    stockStatus || 'in_stock'
  ]);

  return getProductById(numBusinessId, insert.insertId);
}

export async function updateProduct(businessId, rawId, data = {}) {
  const numBusinessId = Number(businessId) || 1;
  const prodId = parseId(rawId);

  const existing = await getProductById(numBusinessId, prodId);
  const {
    name = existing.name,
    sku = existing.sku,
    price = existing.price,
    currency = existing.currency,
    categoryId = existing.category_id,
    description = existing.description,
    imageUrl = existing.image_url,
    whatsappMessageText = existing.whatsapp_message_text,
    stockStatus = existing.stock_status,
    isActive = existing.is_active
  } = data;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const p = store.products.find(x => Number(x.id) === prodId);
    if (p) {
      p.name = name;
      p.sku = sku;
      p.price = parseFloat(price) || 0;
      p.currency = currency;
      p.category_id = categoryId ? Number(categoryId) : null;
      p.description = description;
      p.image_url = imageUrl;
      p.whatsapp_message_text = whatsappMessageText;
      p.stock_status = stockStatus;
      p.is_active = isActive ? 1 : 0;
      p.updated_at = new Date();
      saveMemoryStore();
      return { ...p, hashId: encodeHashId(p.id) };
    }
  }

  await ensureProductTables();

  await executeQuery(`
    UPDATE products 
    SET name = ?, sku = ?, price = ?, currency = ?, category_id = ?, description = ?, image_url = ?, whatsapp_message_text = ?, stock_status = ?, is_active = ?, updated_at = NOW()
    WHERE id = ? AND business_id = ?
  `, [
    name,
    sku,
    parseFloat(price) || 0,
    currency,
    categoryId ? Number(categoryId) : null,
    description,
    imageUrl,
    whatsappMessageText,
    stockStatus,
    isActive ? 1 : 0,
    prodId,
    numBusinessId
  ]);

  return getProductById(numBusinessId, prodId);
}

export async function deleteProduct(businessId, rawId) {
  const numBusinessId = Number(businessId) || 1;
  const prodId = parseId(rawId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.products = (store.products || []).filter(p => !(Number(p.id) === prodId && Number(p.business_id) === numBusinessId));
    saveMemoryStore();
    return { success: true, message: 'Product deleted successfully' };
  }

  await ensureProductTables();
  await executeQuery('DELETE FROM products WHERE id = ? AND business_id = ?', [prodId, numBusinessId]);
  return { success: true, message: 'Product deleted successfully' };
}

export async function getCategories(businessId) {
  const numBusinessId = Number(businessId) || 1;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.product_categories) store.product_categories = [];
    return store.product_categories.filter(c => Number(c.business_id) === numBusinessId);
  }

  await ensureProductTables();

  try {
    const rows = await executeQuery('SELECT * FROM product_categories WHERE business_id = ? ORDER BY name ASC', [numBusinessId]);
    return rows || [];
  } catch (err) {
    logger.error('[ProductsService] Error fetching categories:', err.message);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      tablesChecked = false;
      await ensureProductTables();
      return [];
    }
    return [];
  }
}

export async function createCategory(businessId, data = {}) {
  const numBusinessId = Number(businessId) || 1;
  const { name, description = '' } = data;

  const cleanName = String(name || '').trim();
  if (!cleanName) {
    const err = new Error('Category name is required');
    err.statusCode = 400;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.product_categories) store.product_categories = [];
    const newCat = {
      id: Date.now(),
      business_id: numBusinessId,
      name: cleanName,
      description: description || '',
      created_at: new Date()
    };
    store.product_categories.push(newCat);
    saveMemoryStore();
    return newCat;
  }

  await ensureProductTables();

  const insert = await executeQuery(
    'INSERT INTO product_categories (business_id, name, description, created_at) VALUES (?, ?, ?, NOW())',
    [numBusinessId, cleanName, description || '']
  );

  const newCat = { id: insert.insertId, business_id: numBusinessId, name: cleanName, description: description || '', created_at: new Date() };
  try {
    const store = getMemoryStore();
    if (!store.product_categories) store.product_categories = [];
    if (!store.product_categories.find(c => c.id === newCat.id)) {
      store.product_categories.push(newCat);
    }
  } catch (_) {}

  return newCat;
}
