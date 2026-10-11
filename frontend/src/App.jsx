import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { PublicOnlyRoute } from './components/PublicOnlyRoute.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { ProductLibraryPage } from './pages/ProductLibraryPage.jsx';
import { IngredientExplorerPage } from './pages/IngredientExplorerPage.jsx';
import { RoutinePage } from './pages/RoutinePage.jsx';
import { JournalPage } from './pages/JournalPage.jsx';
import { WaterTrackerPage } from './pages/WaterTrackerPage.jsx';
import { ProgressPage } from './pages/ProgressPage.jsx';
import { AchievementsPage } from './pages/AchievementsPage.jsx';
import { PrivacyPage } from './pages/PrivacyPage.jsx';
import { ExplorePage, LandingPage, NotFoundPage } from './pages/PublicPages.jsx';
import { useAuth } from './services/AuthContext.jsx';
import { SignatureHeart } from './components/SignatureHeart.jsx';

function FeaturePlaceholder({ title }) {
  return <main className="status-page"><span className="eyebrow"><SignatureHeart/> Little Rituals</span><h1>{title}</h1><p>This part of your space will be built in a later feature stage. It won’t show sample records or pretend progress. <SignatureHeart/></p></main>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <main className="status-page"><p>Opening your little space…</p></main>;
  return user ? <Navigate to="/dashboard" replace/> : <LandingPage/>;
}

export function App() {
  return <Routes>
    <Route path="/" element={<HomeRoute/>}/><Route path="/explore" element={<ExplorePage/>}/>
    <Route element={<PublicOnlyRoute/>}>
      <Route path="/login" element={<AuthPage initialMode="login"/>}/><Route path="/register" element={<AuthPage initialMode="register"/>}/>
      <Route path="/forgot-password" element={<AuthPage initialMode="forgot"/>}/>
    </Route>
    <Route path="/reset-password" element={<AuthPage initialMode="reset"/>}/>
    <Route element={<ProtectedRoute/>}>
      <Route path="/dashboard" element={<DashboardPage/>}/>
      <Route path="/profile" element={<ProfilePage/>}/>
      <Route path="/products" element={<ProductLibraryPage/>}/><Route path="/products/:productId" element={<ProductLibraryPage/>}/>
      <Route path="/ingredients" element={<IngredientExplorerPage/>}/><Route path="/ingredients/:id" element={<IngredientExplorerPage/>}/>
      <Route path="/routine" element={<RoutinePage/>}/><Route path="/journal" element={<JournalPage/>}/><Route path="/water" element={<WaterTrackerPage/>}/>
      <Route path="/progress" element={<ProgressPage/>}/>
      <Route path="/achievements" element={<AchievementsPage/>}/><Route path="/certificates" element={<AchievementsPage/>}/>
      <Route path="/settings" element={<PrivacyPage/>}/>
      {['skin-profile','patch-test','gamification','garden','bingo','weather','cycle','cycle-insights','reports'].map((path)=><Route key={path} path={`/${path}`} element={<FeaturePlaceholder title={path.replaceAll('-', ' ')}/>}/>)}
    </Route>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes>;
}
