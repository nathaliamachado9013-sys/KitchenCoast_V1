import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children, title, actions }) => {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {title !== undefined && (
          <header className="page-header">
            <h1 className="page-title">{title}</h1>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
