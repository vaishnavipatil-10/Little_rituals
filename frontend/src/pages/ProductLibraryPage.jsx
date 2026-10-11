import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CircleHelp, Droplets, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { api } from '../services/api.js';
import { classifyExpiry } from '../utils/expiry.js';
import '../styles/products.css';

const categories = ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'exfoliant', 'mask', 'treatment', 'other'];
const statuses = [{ value: 'using', label: 'In use' }, { value: 'finished', label: 'Finished' }, { value: 'expired', label: 'Expired' }, { value: 'irritated', label: 'Irritated me' }];
const blankForm = () => ({ name: '', brand: '', category: 'other', imageUrl: '', ingredientsText: '', purchaseDate: '', openedDate: '', expiryDate: '', paoMonths: '', status: 'using', rating: '', notes: '', price: '', currency: '', wouldRepurchase: '' });
const displayDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
const categoryLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const statusLabel = (value) => statuses.find((status) => status.value === value)?.label || value;

function formFromProduct(product) {
  return { name: product.name || '', brand: product.brand || '', category: product.category || 'other', imageUrl: product.image_path || '', ingredientsText: product.ingredients_text || '',
    purchaseDate: product.purchase_date || '', openedDate: product.opened_date || '', expiryDate: product.expiry_date || '', paoMonths: product.pao_months ?? '', status: product.status || 'using', rating: product.rating ?? '', notes: product.notes || '',
    price: product.price ?? '', currency: product.currency?.trim() || '', wouldRepurchase: product.would_repurchase == null ? '' : String(product.would_repurchase) };
}

function ProductCard({ product, onEdit, onDelete }) {
  const linkedIngredients = (product.product_ingredients || []).map((row) => row.ingredients).filter(Boolean);
  const expiryState = classifyExpiry(product);
  const expiryDays = product.expiry_date ? Math.floor((Date.parse(`${product.expiry_date}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0,10)}T00:00:00Z`)) / 86400000) : null;
  const expiryLabel = expiryState === 'expired' ? 'Past expiry date' : expiryState === 'soon' ? `Expires in ${expiryDays} ${expiryDays === 1 ? 'day' : 'days'}` : expiryState === 'later' ? `Expires ${displayDate(product.expiry_date)}` : '';
  return <article className="product-card">
    <div className="product-photo"><Package className="product-photo-fallback" size={30} strokeWidth={1.2}/>{product.image_path && <img src={product.image_path} alt={`${product.name} product`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => event.currentTarget.remove()}/>}<span className={`product-status status-${product.status}`}>{statusLabel(product.status)}</span></div>
    <div className="product-card-body"><div className="product-card-heading"><div><span className="product-category">{categoryLabel(product.category)}</span><h2>{product.name}</h2>{product.brand && <p className="product-brand">{product.brand}</p>}</div><SignatureHeart className="card-heart"/></div>
      {(product.price != null || product.expiry_date || product.pao_months) && <p className="product-meta">{product.price != null && <span>{product.currency ? `${product.currency.trim()} ` : ''}{Number(product.price).toFixed(2)}</span>}{product.price != null && (product.expiry_date || product.pao_months) && <span> · </span>}{expiryLabel || (product.pao_months ? `PAO ${product.pao_months} months` : '')}</p>}
      {linkedIngredients.length > 0 && <div className="ingredient-chips" aria-label="Linked catalog ingredients">{linkedIngredients.slice(0, 3).map((ingredient) => <span key={ingredient.id}>{ingredient.name}</span>)}{linkedIngredients.length > 3 && <span>+{linkedIngredients.length - 3}</span>}</div>}
      {product.ingredients_text && <p className="product-ingredients">{product.ingredients_text}</p>}{product.notes && <p className="product-note">“{product.notes}”</p>}
      <div className="product-card-footer"><span className="product-rating" aria-label={product.rating ? `Rated ${product.rating} out of 5` : 'Not rated'}>{product.rating ? `${'★'.repeat(product.rating)}${'☆'.repeat(5 - product.rating)}` : 'Not rated'}</span><div><button type="button" className="product-icon-button" aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}>Edit</button><button type="button" className="product-icon-button delete-product" aria-label={`Delete ${product.name}`} onClick={() => onDelete(product)}><Trash2 size={15}/></button></div></div>
    </div>
  </article>;
}

function ProductForm({ product, onClose, onSave, saving, error }) {
  const [form, setForm] = useState(() => product ? formFromProduct(product) : blankForm());
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [ingredientResults, setIngredientResults] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState(() => (product?.product_ingredients || []).map((row) => row.ingredients).filter(Boolean));
  const [ingredientError, setIngredientError] = useState('');
  useEffect(() => {
    if (!ingredientQuery.trim()) { setIngredientResults([]); return undefined; }
    const timer = window.setTimeout(async () => {
      try { const { data } = await api.get('/products/ingredients', { params: { search: ingredientQuery.trim() } }); setIngredientResults(data.ingredients || []); setIngredientError(''); }
      catch { setIngredientError('The ingredient catalog could not be loaded. You can still add ingredient notes below.'); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ingredientQuery]);
  function update(field, value) { setForm((previous) => ({ ...previous, [field]: value })); }
  function toggleIngredient(ingredient) { setSelectedIngredients((previous) => previous.some((item) => item.id === ingredient.id) ? previous.filter((item) => item.id !== ingredient.id) : [...previous, ingredient]); }
  function submit(event) { event.preventDefault(); onSave({ ...form, paoMonths: form.paoMonths || null, rating: form.rating || null, wouldRepurchase: form.wouldRepurchase === '' ? null : form.wouldRepurchase === 'true', ingredientIds: selectedIngredients.map((item) => item.id) }); }
  return <section className="product-editor" aria-labelledby="product-form-title">
    <header className="product-editor-header"><div><span className="eyebrow"><SignatureHeart/> A little more care</span><h2 id="product-form-title">{product ? 'Edit your product' : 'Add to your shelf'}</h2></div><button type="button" className="close-editor" aria-label="Close product form" onClick={onClose}><X size={19}/></button></header>
    <form onSubmit={submit}>{error && <p className="form-error" role="alert">{error}</p>}
      <div className="product-form-grid">
        <label>Product name <span aria-hidden="true">*</span><input required maxLength="160" autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Daily gentle cleanser"/></label>
        <label>Brand<input maxLength="120" value={form.brand} onChange={(event) => update('brand', event.target.value)} placeholder="Brand name"/></label>
        <label>Category<select value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.map((value) => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}>{statuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="form-wide">Product image URL <span className="input-hint">Optional, http or https</span><input type="url" value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} placeholder="https://…"/></label>
        <label>Purchase date<input type="date" value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)}/></label><label>Opened date<input type="date" value={form.openedDate} onChange={(event) => update('openedDate', event.target.value)}/></label>
        <label>Expiry date<input type="date" value={form.expiryDate} onChange={(event) => update('expiryDate', event.target.value)}/></label><label>Period after opening (months)<input type="number" min="1" max="60" step="1" value={form.paoMonths} onChange={(event) => update('paoMonths', event.target.value)} placeholder="e.g. 12"/></label>
        <label>Price<input type="number" min="0" max="99999999.99" step="0.01" value={form.price} onChange={(event) => update('price', event.target.value)} placeholder="Optional"/></label>
        <label>Currency code<input maxLength="3" pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} placeholder="e.g. USD"/></label>
        <label>Personal rating<select value={form.rating} onChange={(event) => update('rating', event.target.value)}><option value="">Not rated</option>{[1,2,3,4,5].map((value) => <option value={value} key={value}>{value} of 5</option>)}</select></label>
        <label>Would you buy it again?<select value={form.wouldRepurchase} onChange={(event) => update('wouldRepurchase', event.target.value)}><option value="">Not decided</option><option value="true">Yes</option><option value="false">No</option></select></label>
        <div className="form-wide catalog-picker"><label htmlFor="ingredient-search">Link catalog ingredients <span className="input-hint">Optional · Choose from the ingredient library</span></label>
          <div className="catalog-search"><Search size={17}/><input id="ingredient-search" value={ingredientQuery} onChange={(event) => setIngredientQuery(event.target.value)} placeholder="Search ingredients" autoComplete="off"/></div>
          {ingredientError && <p className="catalog-error" role="status">{ingredientError}</p>}{ingredientResults.length > 0 && <div className="ingredient-results" aria-label="Ingredient search results">{ingredientResults.map((ingredient) => { const selected = selectedIngredients.some((item) => item.id === ingredient.id); return <button key={ingredient.id} type="button" className={selected ? 'ingredient-option selected' : 'ingredient-option'} onClick={() => toggleIngredient(ingredient)}>{ingredient.name}{selected && <Check size={14}/>}</button>; })}</div>}
          {selectedIngredients.length > 0 && <div className="ingredient-chips selected-chips">{selectedIngredients.map((ingredient) => <button type="button" key={ingredient.id} onClick={() => toggleIngredient(ingredient)} aria-label={`Remove ${ingredient.name}`}>{ingredient.name}<X size={12}/></button>)}</div>}
          {ingredientQuery && !ingredientResults.length && !ingredientError && <p className="input-hint">No catalog matches. You can still note ingredients below.</p>}
        </div>
        <label className="form-wide">Ingredient list or notes<textarea rows="3" maxLength="5000" value={form.ingredientsText} onChange={(event) => update('ingredientsText', event.target.value)} placeholder="Add the ingredient list or anything you want to remember"/></label>
        <label className="form-wide">Personal notes<textarea rows="3" maxLength="5000" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="How does it feel in your routine?"/></label>
      </div>
      <div className="product-form-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button><button className="button button-quiet" type="button" disabled={saving} onClick={onClose}>Cancel</button></div>
    </form>
  </section>;
}

export function ProductLibraryPage() {
  const { productId } = useParams(); const navigate = useNavigate();
  const [products, setProducts] = useState([]); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState(null); const [saveError, setSaveError] = useState(''); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('all'); const [status, setStatus] = useState('all'); const [expiry, setExpiry] = useState('all');
  const loadProducts = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { const { data } = await api.get('/products'); setProducts(data.products || []); }
    catch (error) { setLoadError(error.response?.data?.error?.message || 'Your products could not be loaded. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (!productId || loading) return;
    const found = products.find((product) => product.id === productId);
    if (found) { setEditor(found); setSaveError(''); } else if (!loadError) setLoadError('We could not find that product in your library.');
  }, [productId, products, loading, loadError]);
  const visibleProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLocaleLowerCase();
    const expiryState = classifyExpiry(product);
    const expiryMatch = expiry === 'all' || expiry === expiryState;
    return (!term || `${product.name} ${product.brand || ''}`.toLocaleLowerCase().includes(term)) && (category === 'all' || product.category === category) && (status === 'all' || product.status === status) && expiryMatch;
  }), [products, search, category, status, expiry]);
  const expirySummary = { expired: products.filter((product) => classifyExpiry(product) === 'expired').length, soon: products.filter((product) => classifyExpiry(product) === 'soon').length, unknown: products.filter((product) => classifyExpiry(product) === 'unknown').length };
  function openCreate() { setSaveError(''); setNotice(''); setEditor({ new: true }); }
  function openEdit(product) { setSaveError(''); setNotice(''); setEditor(product); }
  function closeEditor() { setEditor(null); setSaveError(''); if (productId) navigate('/products', { replace: true }); }
  async function saveProduct(value) {
    setSaving(true); setSaveError('');
    try {
      const { data } = editor?.new ? await api.post('/products', value) : await api.patch(`/products/${editor.id}`, value);
      setProducts((current) => editor?.new ? [data.product, ...current] : current.map((item) => item.id === data.product.id ? data.product : item));
      setEditor(null);
      if (productId) navigate('/products', { replace: true });
      setNotice(editor?.new ? 'Your product has been added. ♡' : 'Your product details have been saved. ♡');
    }
    catch (error) { setSaveError(error.response?.data?.error?.message || 'We could not save this product. Please try again.'); }
    finally { setSaving(false); }
  }
  async function deleteProduct(product) {
    if (!window.confirm(`Remove “${product.name}” from your product library? This cannot be undone.`)) return;
    setNotice(''); setLoadError('');
    try { await api.delete(`/products/${product.id}`); setProducts((current) => current.filter((item) => item.id !== product.id)); if (editor?.id === product.id) closeEditor(); setNotice('Product removed from your library.'); }
    catch (error) { setLoadError(error.response?.data?.error?.message || 'That product could not be removed. Please try again.'); }
  }
  return <div className="app-shell"><AppSidebar active="products" className="product-sidebar"/><main className="product-library-main">
    <header className="product-page-top"><Link to="/dashboard" className="back-link"><ArrowLeft size={16}/> Back to your space</Link><span className="product-count">{products.length} {products.length === 1 ? 'product' : 'products'} saved</span></header>
    <section className="product-library-heading"><div><span className="eyebrow"><SignatureHeart/> Your skincare, gathered gently</span><h1>My Products</h1><p>A calm little shelf for the things you use, love, and want to remember.</p></div><button className="button button-primary add-product-button" type="button" onClick={openCreate}><Plus size={17}/> Add a product</button></section>
    {notice && <p className="form-success product-notice" role="status"><SignatureHeart/> {notice}</p>}{loadError && <div className="form-error product-load-error" role="alert"><span>{loadError}</span><button type="button" className="retry-button" onClick={loadProducts}>Try again</button></div>}
    {editor && <ProductForm key={editor.id || (editor.new ? 'new' : 'edit')} product={editor.new ? null : editor} onClose={closeEditor} onSave={saveProduct} saving={saving} error={saveError}/>}
    <div className="product-expiry-summary" aria-label="Expiry overview"><span>{expirySummary.expired} past expiry</span><span>{expirySummary.soon} expiring within 30 days</span><span>{expirySummary.unknown} without a known date</span></div>
    <section className="product-tools" aria-label="Search and filter products"><label className="product-search"><Search size={18}/><span className="visually-hidden">Search products by name or brand</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or brand"/></label>
      <label><span className="visually-hidden">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((value) => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select></label>
      <label><span className="visually-hidden">Filter by product status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span className="visually-hidden">Filter by expiry date</span><select value={expiry} onChange={(event) => setExpiry(event.target.value)}><option value="all">All expiry dates</option><option value="expired">Past expiry</option><option value="soon">Expiring within 30 days</option><option value="unknown">No known expiry</option></select></label>
    </section>
    {loading ? <div className="product-state" role="status"><span className="loading-heart">♡</span><p>Gathering your little shelf…</p></div>
      : !products.length && !loadError ? <div className="product-state product-empty"><span className="empty-heart">♡</span><h2>Your shelf is waiting for you.</h2><p>Start with one product you already reach for. There’s no perfect routine to build.</p><button className="button button-primary" type="button" onClick={openCreate}><Plus size={16}/> Add your first product</button></div>
      : products.length > 0 && !visibleProducts.length ? <div className="product-state"><CircleHelp size={26}/><h2>No products found</h2><p>Try a different search or clear one of the filters.</p><button type="button" className="clear-filters" onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); setExpiry('all'); }}>Clear filters</button></div>
      : <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onEdit={openEdit} onDelete={deleteProduct}/>)}</div>}
    <p className="product-private-note"><Droplets size={14}/> Your product notes are private to your account.</p>
  </main></div>;
}
