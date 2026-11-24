import React from 'react';

export default function SourceReferences({ sources = [] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="ai-sources-container mt-2 pt-2 border-top border-light-subtle">
      <div className="small text-muted d-flex align-items-center gap-1 mb-1">
        <i className="bi bi-book-half"></i>
        <span className="fw-semibold">Documented Sources:</span>
      </div>
      <div className="d-flex flex-wrap gap-1">
        {sources.map((src, i) => (
          <span
            key={i}
            className="badge rounded-pill ai-source-pill"
            title={`Category: ${src.category || 'General'}`}
          >
            <i className="bi bi-file-earmark-text me-1"></i>
            {src.title || src.documentName || 'Official Docs'}
          </span>
        ))}
      </div>
    </div>
  );
}
