import { useState } from 'react';
import SushiNinja from './SushiNinja';
import NinjaWarrior from './NinjaWarrior';

const TABS = [
  { id:'ninja',    label:'🍣 Sushi Ninja',    desc:'Corte os sushis!' },
  { id:'warrior',  label:'⚔️ Ninja Warrior',  desc:'Derrote os inimigos!' },
];

export default function GameHub({ compact=false }) {
  const [tab, setTab] = useState('ninja');

  return (
    <div>
      {/* tab bar */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1, padding:'8px 4px', borderRadius:12,
            background: tab===t.id ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${tab===t.id ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.06)'}`,
            color: tab===t.id ? '#f97316' : '#475569',
            fontWeight: tab===t.id ? 800 : 500,
            fontSize: 12, cursor:'pointer', letterSpacing:-0.2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='ninja'   && <SushiNinja   compact={compact} />}
      {tab==='warrior' && <NinjaWarrior compact={compact} />}
    </div>
  );
}
