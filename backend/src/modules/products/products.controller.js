import * as productsService from './products.service.js';
import logger from '../../utils/logger.js';

export async function listProducts(req, res, next) {
  try {
    const result = await productsService.getProducts(req.businessId || 1, req.query);
    res.json({
      success: true,
      data: result.products || [],
      pagination: result.pagination || { total: 0, limit: 50, offset: 0 },
      stats: result.stats || { totalProducts: 0, inStockCount: 0, categoriesCount: 0 }
    });
  } catch (err) {
    logger.warn('[ProductsController] listProducts fallback:', err.message);
    res.json({
      success: true,
      data: [],
      pagination: { total: 0, limit: 50, offset: 0 },
      stats: { totalProducts: 0, inStockCount: 0, categoriesCount: 0 }
    });
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await productsService.getProductById(req.businessId || 1, req.params.id);
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const product = await productsService.createProduct(req.businessId || 1, req.body);
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await productsService.updateProduct(req.businessId || 1, req.params.id, req.body);
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const result = await productsService.deleteProduct(req.businessId || 1, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
}

export async function listCategories(req, res, next) {
  try {
    const categories = await productsService.getCategories(req.businessId || 1);
    res.json({ success: true, data: categories || [] });
  } catch (err) {
    logger.warn('[ProductsController] listCategories fallback:', err.message);
    res.json({ success: true, data: [] });
  }
}

export async function createCategory(req, res, next) {
  try {
    const category = await productsService.createCategory(req.businessId || 1, req.body);
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (err) {
    next(err);
  }
}
