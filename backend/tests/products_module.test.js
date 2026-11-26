import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as productsService from '../src/modules/products/products.service.js';

describe('Products & Catalogue Library Module Suite', () => {
  const businessId = 888999;
  let createdCategory = null;
  let createdProduct = null;

  it('1. Create product category with tenant isolation', async () => {
    createdCategory = await productsService.createCategory(businessId, {
      name: 'Electronics & Audio',
      description: 'Headphones, speakers, and cables'
    });

    assert.ok(createdCategory);
    assert.strictEqual(createdCategory.name, 'Electronics & Audio');
    assert.strictEqual(Number(createdCategory.business_id), businessId);
  });

  it('2. List categories for tenant', async () => {
    const list = await productsService.getCategories(businessId);
    assert.ok(Array.isArray(list));
    const found = list.find(c => c.name === 'Electronics & Audio');
    assert.ok(found);
  });

  it('3. Create product associated with category', async () => {
    createdProduct = await productsService.createProduct(businessId, {
      name: 'Wireless Noise-Cancelling Headphones',
      sku: 'WNC-001',
      price: 2499.00,
      currency: 'INR',
      categoryId: createdCategory.id,
      stockStatus: 'in_stock',
      description: 'Active noise cancellation with 30-hour battery life.',
      imageUrl: 'https://example.com/headphones.jpg',
      whatsappMessageText: 'Get the Wireless Noise-Cancelling Headphones today for ₹2,499!'
    });

    assert.ok(createdProduct);
    assert.strictEqual(createdProduct.name, 'Wireless Noise-Cancelling Headphones');
    assert.strictEqual(createdProduct.sku, 'WNC-001');
    assert.strictEqual(Number(createdProduct.price), 2499.00);
    assert.strictEqual(createdProduct.stock_status, 'in_stock');
  });

  it('4. List products with search filter and pagination stats', async () => {
    const result = await productsService.getProducts(businessId, {
      search: 'Noise-Cancelling',
      stockStatus: 'ALL'
    });

    assert.ok(result);
    assert.ok(Array.isArray(result.products));
    assert.strictEqual(result.products.length, 1);
    assert.strictEqual(result.products[0].name, 'Wireless Noise-Cancelling Headphones');
    assert.strictEqual(result.stats.inStockCount, 1);
  });

  it('5. Update product price and stock status', async () => {
    const updated = await productsService.updateProduct(businessId, createdProduct.id, {
      price: 1999.00,
      stockStatus: 'out_of_stock'
    });

    assert.ok(updated);
    assert.strictEqual(Number(updated.price), 1999.00);
    assert.strictEqual(updated.stock_status, 'out_of_stock');
  });

  it('6. Strict tenant isolation: other business cannot see products', async () => {
    const otherBusinessId = 999111;
    const result = await productsService.getProducts(otherBusinessId, {});
    assert.strictEqual(result.products.length, 0);
  });

  it('7. Delete product successfully', async () => {
    const res = await productsService.deleteProduct(businessId, createdProduct.id);
    assert.strictEqual(res.success, true);

    const check = await productsService.getProducts(businessId, {});
    assert.strictEqual(check.products.length, 0);
  });
});
