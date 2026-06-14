import React from 'react';
import { usePersonalizacao } from '../hooks/usePersonalizacao';

// ──────────────────────────────────────────────────────────────
//  Fundo animado do sistema — camadas suaves atrás de todo o app.
//  Renderizado uma vez no Layout. O movimento é lento e calmo;
//  pode ser desligado em Personalização (animacao=false).
// ──────────────────────────────────────────────────────────────

// Estrelas cadentes — algumas faixas com atrasos diferentes
function EstrelasCadentes() {
  const trilhas = [
    { top: '12%', left: '8%',  delay: '0s',  dur: '9s'  },
    { top: '26%', left: '55%', delay: '4s',  dur: '11s' },
    { top: '8%',  left: '78%', delay: '7s',  dur: '8s'  },
    { top: '44%', left: '30%', delay: '13s', dur: '12s' },
  ];
  return (
    <div className="fa-cadentes" aria-hidden="true">
      {trilhas.map((t, i) => (
        <span key={i} className="fa-cadente" style={{ top: t.top, left: t.left, animationDelay: t.delay, animationDuration: t.dur }} />
      ))}
    </div>
  );
}

export default function FundoApp() {
  const { config } = usePersonalizacao();
  const { fundo, animacao } = config;
  const temEstrelas = fundo === 'estrelas' || fundo === 'galaxia' || fundo === 'terra';

  return (
    <div className="fundo-app" aria-hidden="true">
      {/* Aurora — brilhos que respiram */}
      {fundo === 'aurora' && (
        <>
          <span className="fa-aurora fa-aurora-1" />
          <span className="fa-aurora fa-aurora-2" />
          <span className="fa-aurora fa-aurora-3" />
        </>
      )}

      {/* Campo de estrelas (estrelas / galáxia / terra) */}
      {temEstrelas && <div className="fa-estrelas" />}
      {temEstrelas && <div className="fa-estrelas fa-estrelas-2" />}

      {/* Galáxia — nebulosa girando devagar */}
      {fundo === 'galaxia' && (
        <>
          <span className="fa-nebula fa-nebula-1" />
          <span className="fa-nebula fa-nebula-2" />
          <span className="fa-nucleo" />
        </>
      )}

      {/* Planeta Terra — esfera azul ao fundo com atmosfera */}
      {fundo === 'terra' && (
        <div className="fa-terra-wrap">
          <span className="fa-terra-atm" />
          <span className="fa-terra" />
        </div>
      )}

      {/* Estrelas cadentes — só quando animação ligada e há estrelas */}
      {animacao && temEstrelas && <EstrelasCadentes />}
    </div>
  );
}
