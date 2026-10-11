import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CircleHelp, Leaf, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { api } from '../services/api.js';
import '../styles/ingredients.css';

function ErrorState({ message, retry }) {
  return <div className="ingredient-state ingredient-error" role="alert"><CircleHelp size={25}/><h2>We couldn’t open the ingredient library.</h2><p>{message}</p>{retry && <button type="button" className="ingredient-text-button" onClick={retry}>Try again</button>}</div>;
}

function TagList({ values, className = '' }) {
  if (!values?.length) return null;
  return <ul className={`ingredient-tags ${className}`}>{values.map((value) => <li key={value}>{value.replaceAll('_', ' ')}</li>)}</ul>;
}

function IngredientCard({ ingredient }) {
  return <article className="ingredient-card"><Link className="ingredient-card-link" to={`/ingredients/${ingredient.id}`}>
    <div className="ingredient-card-top"><span className="ingredient-leaf"><Leaf size={17}/></span><SignatureHeart/></div>
    <span className="ingredient-slug">{ingredient.slug.replaceAll('-', ' ')}</span><h2>{ingredient.name}</h2><p>{ingredient.summary}</p>
    <TagList values={ingredient.tags}/><span className="ingredient-card-cta">Read ingredient notes <ArrowLeft size={14}/></span>
  </Link></article>;
}

function IngredientDetail({ ingredient, products }) {
  const hasDetails = ingredient.benefits?.length || ingredient.cautions?.length || ingredient.suitable_skin_types?.length || ingredient.caution_skin_types?.length || ingredient.uses?.length || ingredient.guidance || ingredient.interactions?.length;
  return <>
    <Link className="ingredient-back" to="/ingredients"><ArrowLeft size={16}/> Back to all ingredients</Link>
    <header className="ingredient-detail-heading"><span className="eyebrow"><SignatureHeart/> Ingredient notes</span><h1>{ingredient.name}</h1><p>{ingredient.summary}</p><TagList values={ingredient.tags}/></header>
    <p className="ingredient-disclaimer"><strong>For general education only.</strong> Ingredient information does not predict how a finished product will affect you. Individual responses vary; this is not diagnosis or medical advice.</p>
    <div className="ingredient-detail-grid">
      {ingredient.uses?.length > 0 && <section className="ingredient-detail-card"><h2>Common uses</h2><ul>{ingredient.uses.map((value) => <li key={value}>{value}</li>)}</ul></section>}
      {ingredient.benefits?.length > 0 && <section className="ingredient-detail-card"><h2>Catalog notes on benefits</h2><ul>{ingredient.benefits.map((value) => <li key={value}>{value}</li>)}</ul></section>}
      {ingredient.cautions?.length > 0 && <section className="ingredient-detail-card caution-card"><h2>Possible cautions</h2><ul>{ingredient.cautions.map((value) => <li key={value}>{value}</li>)}</ul></section>}
      {ingredient.suitable_skin_types?.length > 0 && <section className="ingredient-detail-card"><h2>Skin types mentioned</h2><p>Listed by the catalog as suitable. This is general information, not a guarantee of personal compatibility.</p><TagList values={ingredient.suitable_skin_types}/></section>}
      {ingredient.caution_skin_types?.length > 0 && <section className="ingredient-detail-card caution-card"><h2>Skin types with a catalog caution</h2><TagList values={ingredient.caution_skin_types}/></section>}
      {ingredient.guidance && <section className="ingredient-detail-card"><h2>Usage guidance</h2><p>{ingredient.guidance}</p></section>}
      {ingredient.interactions?.length > 0 && <section className="ingredient-detail-card caution-card"><h2>Interactions noted</h2><ul>{ingredient.interactions.map((value) => <li key={value}>{value}</li>)}</ul></section>}
      {!hasDetails && <section className="ingredient-detail-card"><h2>More catalog notes to come</h2><p>This ingredient has a summary, but the catalog does not currently include additional usage details.</p></section>}
    </div>
    <section className="linked-products-section"><span className="eyebrow"><SignatureHeart/> From your shelf</span><h2>Products linked to this ingredient</h2>
      {products.length ? <div className="linked-products">{products.map((product) => <Link className="linked-product-card" to={`/products/${product.id}`} key={product.id}><span className="linked-product-mark"><Leaf size={16}/></span><span><strong>{product.name}</strong>{product.brand && <small>{product.brand}</small>}</span><small className="linked-product-category">{product.category}</small></Link>)}</div>
        : <p className="linked-products-empty">No products in your library are linked to this catalog ingredient yet.</p>}
    </section>
    {ingredient.reviewed_at && <p className="ingredient-reviewed">Catalog review date: {new Date(`${ingredient.reviewed_at}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>}
  </>;
}

export function IngredientExplorerPage() {
  const { id } = useParams();
  const [ingredients, setIngredients] = useState([]);
  const [detail, setDetail] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [skinType, setSkinType] = useState('all');
  const [tag, setTag] = useState('all');

  const loadIngredients = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get('/ingredients'); setIngredients(data.ingredients || []); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || 'Please check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);
  const loadDetail = useCallback(async (ingredientId) => {
    setLoading(true); setError(''); setDetail(null); setProducts([]);
    try { const { data } = await api.get(`/ingredients/${ingredientId}`); setDetail(data.ingredient); setProducts(data.products || []); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || 'Please check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (id) loadDetail(id); else loadIngredients(); }, [id, loadDetail, loadIngredients]);

  const skinTypes = useMemo(() => [...new Set(ingredients.flatMap((ingredient) => [...(ingredient.suitable_skin_types || []), ...(ingredient.caution_skin_types || [])]))].sort(), [ingredients]);
  const tags = useMemo(() => [...new Set(ingredients.flatMap((ingredient) => ingredient.tags || []))].sort(), [ingredients]);
  const visibleIngredients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return ingredients.filter((ingredient) => {
      const searchText = [ingredient.name, ingredient.summary, ingredient.guidance, ...(ingredient.uses || []), ...(ingredient.benefits || []), ...(ingredient.cautions || []), ...(ingredient.suitable_skin_types || []), ...(ingredient.caution_skin_types || []), ...(ingredient.tags || []), ...(ingredient.interactions || [])].filter(Boolean).join(' ').toLocaleLowerCase();
      const types = [...(ingredient.suitable_skin_types || []), ...(ingredient.caution_skin_types || [])];
      return (!term || searchText.includes(term)) && (skinType === 'all' || types.includes(skinType)) && (tag === 'all' || (ingredient.tags || []).includes(tag));
    });
  }, [ingredients, search, skinType, tag]);

  return <div className="app-shell"><AppSidebar active="ingredients" className="ingredient-sidebar"/><main className="ingredient-explorer-main">
    {id ? loading ? <div className="ingredient-state" role="status"><span className="loading-heart">♡</span><p>Opening ingredient notes…</p></div> : error ? <ErrorState message={error} retry={() => loadDetail(id)}/> : detail ? <IngredientDetail ingredient={detail} products={products}/> : null
      : <>
        <header className="ingredient-explorer-heading"><div><span className="eyebrow"><SignatureHeart/> A little ingredient clarity</span><h1>Ingredient Explorer</h1><p>Thoughtful notes from the ingredient catalog, gathered in one place.</p></div><span className="ingredient-heading-mark"><Leaf size={28} strokeWidth={1.3}/><SignatureHeart/></span></header>
        <p className="ingredient-disclaimer"><strong>General education only.</strong> Ingredient notes aren’t a safety rating or personal recommendation. Finished formulas and individual responses vary; this is not medical advice.</p>
        {!loading && !error && ingredients.length > 0 && <section className="ingredient-tools" aria-label="Search and filter ingredients">
          <label className="ingredient-search"><Search size={18}/><span className="visually-hidden">Search by ingredient name, benefits, cautions, uses, or skin type</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, benefits, or skin notes"/></label>
          {skinTypes.length > 0 && <label><span className="visually-hidden">Filter by skin type mentioned</span><select value={skinType} onChange={(event) => setSkinType(event.target.value)}><option value="all">All skin type notes</option>{skinTypes.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
          {tags.length > 0 && <label><span className="visually-hidden">Filter by catalog tag</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">All catalog tags</option>{tags.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
        </section>}
        {loading ? <div className="ingredient-state" role="status"><span className="loading-heart">♡</span><p>Gathering ingredient notes…</p></div>
          : error ? <ErrorState message={error} retry={loadIngredients}/>
          : ingredients.length === 0 ? <div className="ingredient-state ingredient-empty"><span className="empty-heart">♡</span><h2>The ingredient catalog is not populated yet.</h2><p>There are no ingredient records to explore right now. This page will show catalog notes when they’re added; no sample facts or product connections are shown.</p><p className="ingredient-empty-note">Product ingredient lists you’ve entered remain in your Product Library.</p></div>
          : visibleIngredients.length ? <div className="ingredient-card-grid">{visibleIngredients.map((ingredient) => <IngredientCard key={ingredient.id} ingredient={ingredient}/>)}</div>
          : <div className="ingredient-state"><CircleHelp size={25}/><h2>No ingredient notes found</h2><p>Try another search or clear the filters.</p><button type="button" className="ingredient-text-button" onClick={() => { setSearch(''); setSkinType('all'); setTag('all'); }}>Clear filters</button></div>}
      </>}
    <p className="ingredient-footer-note">Catalog information is general education and is not medical advice.</p>
  </main></div>;
}
