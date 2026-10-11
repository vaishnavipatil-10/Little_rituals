import { Link } from 'react-router-dom';

export function Brand({ className = '' }) {
  return <Link className={`brand ${className}`} to="/" aria-label="Little Rituals home">
    <img src="/little-rituals-mark.svg" alt="" />
  </Link>;
}
