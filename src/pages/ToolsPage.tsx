import { useState } from 'react';
import DraftTheory from '../components/tools/DraftTheory';

type ToolTab = 'draft-theory';

export default function ToolsPage() {
  const [activeTab] = useState<ToolTab>('draft-theory');

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-white">Tools</h1>
        <p className="text-gray-400 mt-1">Utilities and simulators for draft planning</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-lol-border mt-6 shrink-0">
        <nav className="flex gap-4">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'draft-theory'
                ? 'border-lol-gold text-lol-gold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Draft Theorycrafting
          </button>
          {/* Future tabs can be added here */}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 mt-6">
        {activeTab === 'draft-theory' && <DraftTheory />}
      </div>
    </div>
  );
}
