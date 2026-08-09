import { useState, useLayoutEffect, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Hand } from 'lucide-react';

const STEPS = [
  {
    title: 'Bem-vindo ao Magalhães!',
    description: 'Este é o seu novo sistema inteligente de gestão financeira. Vamos dar uma volta rápida para você conhecer tudo.',
    targetId: 'tutorial-sidebar-header',
    view: 'dashboard',
    position: 'right'
  },
  {
    title: 'Menu de Navegação',
    description: 'Aqui fica o menu principal. Você pode alternar entre Visão Geral, contas a pagar, contas a receber e ver o histórico de tudo que já foi pago.',
    targetId: 'tutorial-sidebar-nav',
    view: 'dashboard',
    position: 'right'
  },
  {
    title: 'Alertas Inteligentes',
    description: 'Este sino avisa quando há contas vencidas ou vencendo hoje/amanhã. Ele fica vermelhinho para chamar sua atenção.',
    targetId: 'tutorial-bell',
    view: 'dashboard',
    position: 'bottom'
  },
  {
    title: 'Resumo Financeiro',
    description: 'Estes cards mostram a saúde do seu negócio no mês: quanto entrou, quanto saiu, sua rentabilidade e as contas atrasadas.',
    targetId: 'tutorial-summary-cards',
    view: 'dashboard',
    position: 'bottom'
  },
  {
    title: 'Gráfico de Evolução',
    description: 'Acompanhe visualmente o fluxo do seu dinheiro dia após dia.',
    targetId: 'tutorial-monthly-chart',
    view: 'dashboard',
    position: 'right'
  },
  {
    title: 'Exportar Relatório',
    description: 'Precisa enviar os dados para alguém ou guardar? Clique aqui para gerar um PDF com todo o fechamento do mês.',
    targetId: 'tutorial-export-pdf',
    view: 'dashboard',
    position: 'bottom'
  },
  {
    title: 'Contas a Pagar',
    description: 'Esta é a tela de despesas. Você pode ler boletos PDF automaticamente clicando neste botão. A IA preenche os dados para você!',
    targetId: 'tutorial-import-boleto',
    view: 'pending',
    position: 'bottom'
  },
  {
    title: 'Registro Manual',
    description: 'Se não tiver o boleto em PDF, pode registrar a despesa manualmente clicando aqui.',
    targetId: 'tutorial-new-pending',
    view: 'pending',
    position: 'bottom'
  },
  {
    title: 'Despesas Recorrentes',
    description: 'Ao registrar manualmente, marque esta opção para contas como Aluguel ou Internet. O sistema vai recriá-las sozinho todo mês!',
    targetId: 'tutorial-pending-recurring-checkbox',
    view: 'pending',
    position: 'top', // Needs to be shown inside the modal, but the modal is only open when clicking...
    // Actually wait, if the modal is not open, the element won't exist.
    // Let's change the step to just point to the table.
    skipElementCheck: true, // We'll handle this differently or skip for now if element not found.
  },
  {
    title: 'Gerenciando Pagamentos',
    description: 'Aqui ficam suas despesas. Quando pagar, é só clicar em "Pago" e a conta vai para o Histórico de Pagos.',
    targetId: 'tutorial-pending-table',
    view: 'pending',
    position: 'top'
  },
  {
    title: 'Contas a Receber',
    description: 'Registre aqui tudo que seus clientes te devem. Funciona igualzinho ao Contas a Pagar!',
    targetId: 'tutorial-new-receivable',
    view: 'receivable',
    position: 'bottom'
  },
  {
    title: 'Histórico Pago',
    description: 'Tudo que você pagou vem parar aqui. O seu arquivo morto digital.',
    targetId: 'tutorial-expenses-table',
    view: 'expenses',
    position: 'top'
  },
  {
    title: 'Anexar Comprovantes',
    description: 'Você pode anexar o comprovante de pagamento ou nota fiscal clicando no ícone de clipe. Assim você nunca perde um recibo!',
    targetId: 'tutorial-expense-attachment',
    view: 'expenses',
    position: 'left'
  },
  {
    title: 'Visão do Mês',
    description: 'O Calendário mostra suas contas distribuídas pelos dias. Bolinhas vermelhas são despesas, verdes são receitas.',
    targetId: 'tutorial-calendar-full',
    view: 'calendar',
    position: 'top'
  },
  {
    title: 'Categorias e Cadastros',
    description: 'Nas configurações, você cadastra suas Categorias de despesas. É essencial para o gráfico de pizza funcionar!',
    targetId: 'tutorial-settings-categories',
    view: 'settings',
    position: 'right'
  },
  {
    title: 'Pronto para usar!',
    description: 'Se quiser rever este tutorial, basta vir na aba Tutorial & Ajuda aqui nas Configurações. Aproveite o sistema!',
    targetId: 'tutorial-settings-tutorial',
    view: 'settings',
    position: 'right'
  }
];

export default function Tutorial({ onFinish, onNavigate }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = STEPS[stepIndex];

  // Filtro corrigindo passo 9, como o modal não abre automático, vou pular ele do array dinamicamente se quiser, ou alterar para apontar pro botão "registrar" explicando
  // Vou substituir a info do passo 9.
  STEPS[8].targetId = 'tutorial-new-pending';
  STEPS[8].description = 'Dica: Ao registrar manualmente uma conta fixa (ex: Aluguel), marque a opção "Recorrente". O sistema vai renovar a conta sozinho todo mês!';

  useEffect(() => {
    // Navigate to the correct view BEFORE highlighting
    if (onNavigate && step.view) {
      onNavigate(step.view);
    }
  }, [stepIndex, onNavigate, step.view]);

  // Recalculate rectangle after navigation and DOM update
  useLayoutEffect(() => {
    let animationFrameId;
    let timeoutId;
    
    const updateRect = () => {
      const el = document.getElementById(step.targetId);
      if (el) {
        const bounds = el.getBoundingClientRect();
        // Give it a tiny padding
        setRect({
          top: bounds.top - 4,
          left: bounds.left - 4,
          width: bounds.width + 8,
          height: bounds.height + 8
        });
      } else {
        setRect(null); // fallback if element not found
      }
    };

    // Keep checking for the element to appear after navigation
    const checkLoop = () => {
      updateRect();
      if (!document.getElementById(step.targetId)) {
        animationFrameId = requestAnimationFrame(checkLoop);
      }
    };

    // Start checking
    checkLoop();
    // Re-check after 300ms just in case it was a transition
    timeoutId = setTimeout(updateRect, 300);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step.targetId, stepIndex]);

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else finish();
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const finish = () => {
    localStorage.setItem('showTutorial', 'false');
    onFinish();
  };

  // Smart Tooltip Positioning
  const getTooltipStyle = () => {
    if (!rect) {
      // Fallback: center screen
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const tooltipWidth = 320;
    const padding = 16;
    let top = 0;
    let left = 0;

    // Base positions
    if (step.position === 'bottom') {
      top = rect.top + rect.height + padding;
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    } else if (step.position === 'top') {
      top = rect.top - padding;
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    } else if (step.position === 'right') {
      top = rect.top + (rect.height / 2);
      left = rect.left + rect.width + padding;
    } else if (step.position === 'left') {
      top = rect.top + (rect.height / 2);
      left = rect.left - tooltipWidth - padding;
    }

    // Adjust for vertical centering if right/left
    if (step.position === 'right' || step.position === 'left') {
      // translateY will handle it in CSS, but we need to check bounds
      // actually, let\'s calculate exact px
    }

    // Clamp to window boundaries
    const margin = 12;
    
    // Quick clamping (simplified for exact pixels)
    // For Top/Bottom positions
    if (step.position === 'bottom' || step.position === 'top') {
      // Too far left
      if (left < margin) left = margin;
      // Too far right
      if (left + tooltipWidth > window.innerWidth - margin) {
        left = window.innerWidth - tooltipWidth - margin;
      }
    }
    
    // For Right/Left positions
    if (step.position === 'right' || step.position === 'left') {
      // If right goes off screen, flip to left
      if (step.position === 'right' && left + tooltipWidth > window.innerWidth - margin) {
        left = rect.left - tooltipWidth - padding;
      }
      // If left goes off screen, flip to right
      if (step.position === 'left' && left < margin) {
        left = rect.left + rect.width + padding;
      }
    }

    // For Top positions going off top screen, flip to bottom
    if (step.position === 'top' && top < 200) { // arbitrary height for tooltip
       top = rect.top + rect.height + padding;
    }
    
    // For Bottom positions going off bottom screen, flip to top
    if (step.position === 'bottom' && top > window.innerHeight - 200) {
       top = rect.top - padding;
    }

    const style = {
      position: 'absolute',
      width: tooltipWidth,
      zIndex: 10000,
      left: `${left}px`,
      top: `${top}px`,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    };

    if (step.position === 'top') style.transform = 'translateY(-100%)';
    if (step.position === 'right' || step.position === 'left') style.transform = 'translateY(-50%)';

    return style;
  };

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(36, 59, 157, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(36, 59, 157, 0); }
          100% { box-shadow: 0 0 0 0 rgba(36, 59, 157, 0); }
        }
      `}</style>

      {/* Overlay Escuro Total */}
      <div 
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9998,
          pointerEvents: 'auto',
          backdropFilter: 'blur(2px)'
        }} 
      />

      {/* Spotlight Buraco (Clip-path) ou Borda Brilhante */}
      {rect && (
        <div 
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            zIndex: 9999,
            borderRadius: 8,
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none',
            animation: 'pulse-ring 2s infinite',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      )}

      {/* Balão de Dica (Tooltip) */}
      <div style={getTooltipStyle()}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Cabeçalho do Balão */}
          <div style={{
            background: 'linear-gradient(135deg, #243b9d, #1a2a6c)',
            padding: '1.25rem 1.5rem',
            color: 'white',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              padding: 8,
              display: 'flex'
            }}>
              <Hand size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{step.title}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
                Passo {stepIndex + 1} de {STEPS.length}
              </p>
            </div>
          </div>

          {/* Corpo do Balão */}
          <div style={{ padding: '1.5rem', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {step.description}
          </div>

          {/* Rodapé e Controles */}
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-body)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button 
              onClick={finish}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Pular Tudo
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={handlePrev}
                disabled={stepIndex === 0}
                style={{ padding: '0.5rem', opacity: stepIndex === 0 ? 0.5 : 1 }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNext}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {stepIndex === STEPS.length - 1 ? 'Concluir' : 'Próximo'}
                {stepIndex < STEPS.length - 1 && <ChevronRight size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
