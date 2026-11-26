import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

export default function ProductLibrary() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab from query param or default 'all'
  const initialTab = searchParams.get('tab') || 'all';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    inStockCount: 0,
    categoriesCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [feedback, setFeedback] = useState(null);

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    price: '',
    currency: 'INR',
    categoryId: '',
    stockStatus: 'in_stock',
    imageUrl: '',
    description: '',
    whatsappMessageText: ''
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'all') {
      searchParams.delete('tab');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ tab });
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [activeTab, selectedCategory]);

  const loadCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      if (res.data?.success && res.data?.data) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      let stockStatus = 'ALL';
      if (activeTab === 'in_stock') stockStatus = 'in_stock';
      if (activeTab === 'out_of_stock') stockStatus = 'out_of_stock';

      const res = await api.get('/products', {
        params: {
          search,
          categoryId: selectedCategory,
          stockStatus
        }
      });

      if (res.data?.success && res.data?.data) {
        setProducts(res.data.data);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to load products'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadProducts();
  };

  // Open modal for Create
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      price: '',
      currency: 'INR',
      categoryId: categories.length > 0 ? categories[0].id : '',
      stockStatus: 'in_stock',
      imageUrl: '',
      description: '',
      whatsappMessageText: ''
    });
    setShowProductModal(true);
  };

  // Open modal for Edit
  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      sku: prod.sku || '',
      price: prod.price || '',
      currency: prod.currency || 'INR',
      categoryId: prod.category_id || '',
      stockStatus: prod.stock_status || 'in_stock',
      imageUrl: prod.image_url || '',
      description: prod.description || '',
      whatsappMessageText: prod.whatsapp_message_text || ''
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setFeedback({ type: 'danger', message: 'Product name is required.' });
      return;
    }

    setSaving(true);
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.hashId || editingProduct.id}`, productForm);
        setFeedback({ type: 'success', message: 'Product updated successfully!' });
      } else {
        await api.post('/products', productForm);
        setFeedback({ type: 'success', message: 'New product added to catalog!' });
      }
      setShowProductModal(false);
      loadProducts();
      loadCategories();
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to save product.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (prod) => {
    if (!window.confirm(`Are you sure you want to delete "${prod.name}"?`)) return;

    try {
      await api.delete(`/products/${prod.hashId || prod.id}`);
      setFeedback({ type: 'success', message: 'Product deleted.' });
      loadProducts();
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to delete product.'
      });
    }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    setSaving(true);
    try {
      await api.post('/products/categories', categoryForm);
      setFeedback({ type: 'success', message: 'Category added successfully!' });
      setShowCategoryModal(false);
      setCategoryForm({ name: '', description: '' });
      loadCategories();
      loadProducts();
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to create category.'
      });
    } finally {
      setSaving(false);
    }
  };

  const copyWhatsAppShare = (prod) => {
    const text = prod.whatsapp_message_text || 
      `*${prod.name}*\nPrice: ₹${prod.price}\n${prod.description ? prod.description + '\n' : ''}Reply YES to order or enquire!`;
    navigator.clipboard.writeText(text);
    setFeedback({ type: 'success', message: 'WhatsApp message text copied to clipboard!' });
  };

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Top Banner Alert / Feedback */}
      {feedback && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show d-flex align-items-center mb-4`} role="alert">
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2 fs-5`}></i>
          <div className="flex-grow-1">{feedback.message}</div>
          <button type="button" className="btn-close" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary-subtle text-primary p-2 rounded-3">
              <i className="bi bi-box-seam fs-4"></i>
            </span>
            <div>
              <h1 className="h3 mb-0 fw-bold">Product Library & Catalogue</h1>
              <p className="text-muted small mb-0">
                Organize your product catalogue, track stock levels, and power automated WhatsApp sales conversations.
              </p>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => navigate('/automations')}
          >
            <i className="bi bi-robot"></i>
            <span>Automation Messages</span>
          </button>
          <button
            className="btn btn-outline-primary d-flex align-items-center gap-2"
            onClick={() => setShowCategoryModal(true)}
          >
            <i className="bi bi-folder-plus"></i>
            <span>Add Category</span>
          </button>
          <button
            className="btn btn-success d-flex align-items-center gap-2 shadow-sm"
            onClick={handleOpenCreateProduct}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-muted small mb-1 fw-semibold text-uppercase tracking-wider">Total Products</p>
                <h3 className="fw-bold mb-0 text-dark">{stats.totalProducts}</h3>
              </div>
              <div className="bg-primary-subtle text-primary p-3 rounded-circle">
                <i className="bi bi-box-seam fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-muted small mb-1 fw-semibold text-uppercase tracking-wider">In Stock</p>
                <h3 className="fw-bold mb-0 text-success">{stats.inStockCount}</h3>
              </div>
              <div className="bg-success-subtle text-success p-3 rounded-circle">
                <i className="bi bi-check2-circle fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-muted small mb-1 fw-semibold text-uppercase tracking-wider">Categories</p>
                <h3 className="fw-bold mb-0 text-info">{stats.categoriesCount || categories.length}</h3>
              </div>
              <div className="bg-info-subtle text-info p-3 rounded-circle">
                <i className="bi bi-grid-3x3-gap fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Card with Navigation Tabs */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="card-header bg-white border-bottom pt-3 pb-0 px-4">
          <ul className="nav nav-tabs card-header-tabs border-bottom-0">
            <li className="nav-item">
              <button
                className={`nav-link pb-3 px-3 fw-semibold ${activeTab === 'all' ? 'active text-primary border-primary border-bottom border-2' : 'text-muted'}`}
                onClick={() => handleTabChange('all')}
              >
                <i className="bi bi-collection me-2"></i>
                All Products
                <span className="badge bg-light text-dark ms-2">{stats.totalProducts}</span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link pb-3 px-3 fw-semibold ${activeTab === 'in_stock' ? 'active text-success border-success border-bottom border-2' : 'text-muted'}`}
                onClick={() => handleTabChange('in_stock')}
              >
                <i className="bi bi-check-circle me-2"></i>
                In Stock
                <span className="badge bg-success-subtle text-success ms-2">{stats.inStockCount}</span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link pb-3 px-3 fw-semibold ${activeTab === 'out_of_stock' ? 'active text-danger border-danger border-bottom border-2' : 'text-muted'}`}
                onClick={() => handleTabChange('out_of_stock')}
              >
                <i className="bi bi-x-circle me-2"></i>
                Out of Stock
                <span className="badge bg-danger-subtle text-danger ms-2">
                  {Math.max(0, stats.totalProducts - stats.inStockCount)}
                </span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link pb-3 px-3 fw-semibold ${activeTab === 'categories' ? 'active text-primary border-primary border-bottom border-2' : 'text-muted'}`}
                onClick={() => handleTabChange('categories')}
              >
                <i className="bi bi-tags me-2"></i>
                Categories
                <span className="badge bg-info-subtle text-info ms-2">{categories.length}</span>
              </button>
            </li>
          </ul>
        </div>

        {/* Tab 1, 2, 3: Products View */}
        {activeTab !== 'categories' && (
          <div className="card-body p-4">
            {/* Filter & Search Bar */}
            <div className="row g-3 align-items-center justify-content-between mb-4">
              <div className="col-12 col-md-5">
                <form onSubmit={handleSearchSubmit} className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control bg-light border-start-0"
                    placeholder="Search by product name, SKU or keyword..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      className="btn btn-light border"
                      onClick={() => { setSearch(''); loadProducts(); }}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                  <button type="submit" className="btn btn-outline-secondary">Search</button>
                </form>
              </div>

              <div className="col-12 col-md-7 d-flex flex-wrap align-items-center justify-content-md-end gap-2">
                <div className="d-flex align-items-center gap-2">
                  <label className="text-muted small fw-semibold mb-0">Category:</label>
                  <select
                    className="form-select form-select-sm w-auto"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="btn-group btn-group-sm ms-2" role="group">
                  <button
                    type="button"
                    className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <i className="bi bi-grid-fill"></i>
                  </button>
                  <button
                    type="button"
                    className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setViewMode('table')}
                    title="Table View"
                  >
                    <i className="bi bi-list-ul"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted mt-2 mb-0">Loading product catalogue...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && products.length === 0 && (
              <div className="text-center py-5 bg-light rounded-4 my-2">
                <div className="mb-3 text-muted">
                  <i className="bi bi-box-seam display-3 opacity-50"></i>
                </div>
                <h5 className="fw-bold">No Products Found</h5>
                <p className="text-muted small max-w-md mx-auto mb-4" style={{ maxWidth: '420px' }}>
                  {search || selectedCategory !== 'ALL'
                    ? 'No products matched your search filter. Try clearing your filters or searching with another term.'
                    : 'Start building your WhatsApp product catalog. Customers in automations can browse, ask questions, and request callbacks.'}
                </p>
                <button className="btn btn-success" onClick={handleOpenCreateProduct}>
                  <i className="bi bi-plus-lg me-2"></i>Add First Product
                </button>
              </div>
            )}

            {/* Grid View */}
            {!loading && products.length > 0 && viewMode === 'grid' && (
              <div className="row g-3">
                {products.map((prod) => (
                  <div key={prod.id || prod.hashId} className="col-12 col-md-6 col-lg-4 col-xl-3">
                    <div className="card h-100 border rounded-3 shadow-xs hover-shadow transition">
                      {/* Product Image / Placeholder */}
                      <div
                        className="bg-light d-flex align-items-center justify-content-center position-relative overflow-hidden"
                        style={{ height: '170px' }}
                      >
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-100 h-100 object-fit-cover"
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x300?text=Product'; }}
                          />
                        ) : (
                          <div className="text-center text-muted">
                            <i className="bi bi-image fs-1 opacity-50"></i>
                            <div className="small opacity-75">No image</div>
                          </div>
                        )}
                        <span
                          className={`badge position-absolute top-0 end-0 m-2 ${
                            prod.stock_status === 'in_stock'
                              ? 'bg-success text-white'
                              : 'bg-danger text-white'
                          }`}
                        >
                          {prod.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="card-body p-3 d-flex flex-column">
                        <div className="d-flex align-items-center gap-1 mb-1">
                          <span className="badge bg-secondary-subtle text-secondary small">
                            {prod.category_name || 'General'}
                          </span>
                          {prod.sku && (
                            <span className="badge bg-light text-muted small border">
                              SKU: {prod.sku}
                            </span>
                          )}
                        </div>

                        <h6 className="card-title fw-bold mb-1 text-truncate" title={prod.name}>
                          {prod.name}
                        </h6>

                        <p className="text-muted small mb-2 flex-grow-1 line-clamp-2" style={{ minHeight: '38px' }}>
                          {prod.description || 'No description provided.'}
                        </p>

                        <div className="d-flex align-items-baseline justify-content-between mb-3">
                          <span className="h5 fw-bold text-success mb-0">
                            {prod.currency === 'INR' ? '₹' : '$'} {Number(prod.price || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Card Actions */}
                        <div className="d-flex align-items-center gap-1 pt-2 border-top">
                          <button
                            className="btn btn-sm btn-outline-success flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                            onClick={() => copyWhatsAppShare(prod)}
                            title="Copy WhatsApp text"
                          >
                            <i className="bi bi-whatsapp"></i>
                            <span className="small">Copy Text</span>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleOpenEditProduct(prod)}
                            title="Edit Product"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteProduct(prod)}
                            title="Delete Product"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {!loading && products.length > 0 && viewMode === 'table' && (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '60px' }}>Image</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((prod) => (
                      <tr key={prod.id || prod.hashId}>
                        <td>
                          {prod.image_url ? (
                            <img
                              src={prod.image_url}
                              alt={prod.name}
                              className="rounded border"
                              style={{ width: '42px', height: '42px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              className="rounded bg-light border d-flex align-items-center justify-content-center text-muted"
                              style={{ width: '42px', height: '42px' }}
                            >
                              <i className="bi bi-box"></i>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="fw-bold">{prod.name}</div>
                          {prod.description && (
                            <small className="text-muted text-truncate d-block" style={{ maxWidth: '280px' }}>
                              {prod.description}
                            </small>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-secondary-subtle text-secondary">
                            {prod.category_name || 'General'}
                          </span>
                        </td>
                        <td>
                          <code className="text-muted">{prod.sku || '—'}</code>
                        </td>
                        <td>
                          <span className="fw-semibold text-dark">
                            {prod.currency === 'INR' ? '₹' : '$'} {Number(prod.price || 0).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              prod.stock_status === 'in_stock'
                                ? 'bg-success-subtle text-success'
                                : 'bg-danger-subtle text-danger'
                            }`}
                          >
                            {prod.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-success"
                              onClick={() => copyWhatsAppShare(prod)}
                              title="Copy WhatsApp Text"
                            >
                              <i className="bi bi-whatsapp"></i>
                            </button>
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleOpenEditProduct(prod)}
                              title="Edit"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleDeleteProduct(prod)}
                              title="Delete"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Categories View */}
        {activeTab === 'categories' && (
          <div className="card-body p-4">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <h5 className="fw-bold mb-1">Product Categories</h5>
                <p className="text-muted small mb-0">
                  Organize your catalogue into logical groups for WhatsApp catalogue menus.
                </p>
              </div>
              <button
                className="btn btn-primary d-flex align-items-center gap-2"
                onClick={() => setShowCategoryModal(true)}
              >
                <i className="bi bi-plus-lg"></i>
                <span>Add New Category</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-5 bg-light rounded-4">
                <i className="bi bi-grid-3x3-gap display-4 text-muted opacity-50 mb-3"></i>
                <h6 className="fw-bold">No Categories Found</h6>
                <p className="text-muted small mb-3">
                  Create categories like Electronics, Clothing, Services, or FMCG to group your products.
                </p>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowCategoryModal(true)}
                >
                  <i className="bi bi-plus-lg me-1"></i> Add Category
                </button>
              </div>
            ) : (
              <div className="row g-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="col-12 col-md-6 col-lg-4">
                    <div className="card border h-100 rounded-3 p-3">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-primary-subtle text-primary p-3 rounded-3">
                          <i className="bi bi-folder2-open fs-4"></i>
                        </div>
                        <div className="flex-grow-1">
                          <h6 className="fw-bold mb-1">{cat.name}</h6>
                          <p className="text-muted small mb-0">
                            {cat.description || 'No description provided.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow rounded-4">
              <form onSubmit={handleSaveProduct}>
                <div className="modal-header border-bottom px-4">
                  <h5 className="modal-title fw-bold">
                    <i className="bi bi-box-seam text-primary me-2"></i>
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowProductModal(false)}
                  ></button>
                </div>

                <div className="modal-body px-4 py-3">
                  <div className="row g-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label fw-semibold">Product Name <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Premium Cotton T-Shirt"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">SKU / Code</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. TSH-001"
                        value={productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Price</label>
                      <div className="input-group">
                        <select
                          className="form-select"
                          style={{ maxWidth: '85px' }}
                          value={productForm.currency}
                          onChange={(e) => setProductForm({ ...productForm, currency: e.target.value })}
                        >
                          <option value="INR">₹ INR</option>
                          <option value="USD">$ USD</option>
                          <option value="EUR">€ EUR</option>
                          <option value="AED">AED</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          placeholder="0.00"
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Category</label>
                      <select
                        className="form-select"
                        value={productForm.categoryId}
                        onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Stock Status</label>
                      <select
                        className="form-select"
                        value={productForm.stockStatus}
                        onChange={(e) => setProductForm({ ...productForm, stockStatus: e.target.value })}
                      >
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold">Image URL</label>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://example.com/product-image.jpg"
                        value={productForm.imageUrl}
                        onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                      />
                      <small className="text-muted">Publicly accessible image link to send in WhatsApp messages.</small>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold">Product Description</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="Key features, specifications, and warranty details..."
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      ></textarea>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold">
                        <i className="bi bi-whatsapp text-success me-1"></i> WhatsApp Message Share Text
                      </label>
                      <textarea
                        className="form-control"
                        rows="2"
                        placeholder="Custom promotional text when this product is shared with a customer in WhatsApp chats or automations..."
                        value={productForm.whatsappMessageText}
                        onChange={(e) => setProductForm({ ...productForm, whatsappMessageText: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top px-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowProductModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-1"></i>
                        {editingProduct ? 'Update Product' : 'Add Product'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow rounded-4">
              <form onSubmit={handleSaveCategory}>
                <div className="modal-header border-bottom px-4">
                  <h5 className="modal-title fw-bold">
                    <i className="bi bi-folder-plus text-primary me-2"></i>
                    Add Category
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowCategoryModal(false)}
                  ></button>
                </div>

                <div className="modal-body px-4 py-3">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Category Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Healthcare Products"
                      required
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Brief note about products in this category..."
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top px-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowCategoryModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
