import * as productsService from './products.service.js';

export async function listProducts(req, res, next) {
  try {
    const result = await productsService.getProducts(req.businessId, req.query);
    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
      stats: result.stats
    });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await productsService.getProductById(req.businessId, req.params.id);
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const product = await productsService.createProduct(req.businessId, req.body);
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
    const product = await productsService.updateProduct(req.businessId, req.params.id, req.body);
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
    const result = await productsService.deleteProduct(req.businessId, req.params.id);
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
}

export async function listCategories(req, res, next) {
  try {
    const categories = await productsService.getCategories(req.businessId);
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const category = await productsService.createCategory(req.businessId, req.body);
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (err) {
    next(err);
  }
}
