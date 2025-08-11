import React from 'react';
import './EditorToolbar.css';

function EditorToolbar({ activeTool, onToolSelect, onSave, onCancel, isSaving }) {
  return (
    <div className="editor-toolbar-container">
      <div className="tools">
        <h4>Editing Tools</h4>
        <button
          onClick={() => onToolSelect('delete')}
          className={activeTool === 'delete' ? 'active' : ''}
        >
          Delete Grain
        </button>
        <button
          onClick={() => onToolSelect('split')}
          className={activeTool === 'split' ? 'active' : ''}
          disabled // Disable split for now
        >
          Split Grain
        </button>
      </div>
      <div className="actions">
        <button onClick={onSave} className="save-btn" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save & Exit'}
        </button>
        <button onClick={onCancel} className="cancel-btn" disabled={isSaving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default EditorToolbar;
