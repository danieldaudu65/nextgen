'use client';

// "Enter the world" button in the homepage heading. It asks first (the question lives in WorldTeaser).
export default function EnterWorldButton(){
  return (
    <button type="button" className="btn wt-enter" onClick={() => window.dispatchEvent(new CustomEvent('ng:enter-world', { detail: '/arcade' }))}>
      🌍 Enter the world
    </button>
  );
}
