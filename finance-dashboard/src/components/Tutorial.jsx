import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, BookOpen, GraduationCap } from 'lucide-react';

// Definição dos 12 passos do tutorial
const STEPS = [
  {
    id: 'sidebar',
    target: '.sidebar-nav',
    title: '👋 Bem-vindo ao Magalhaes Inteligencia!',
    description: 'Este é o menu lateral do sistema. Por aqui você navega entre todas as seções: Visão Geral, A Pagar, A Receber, Histórico, Calendário e Configurações. Vamos conhecer cada uma delas!',
    position: 'right',
  },
  {
    id: 'dashboard',
    target: '.page-content',
    title: '📊 Painel de Controle (Dashboard)',
    description: 'Esta é a sua tela principal! Aqui você vê um resumo completo das suas finanças: total de receitas, despesas pagas, saldo projetado e gráficos de evolução mensal. Sempre que entrar, comece por aqui para ter a visão do todo.',
    position: 'center',
  },
  {
    id: 'notifications',
    target: '.topbar',
    title: '🔔 Sino de Alertas',
    description: 'No canto superior direito fica o sino de notificações. Ele fica vermelho quando você tem contas vencidas ou que vencem hoje/amanhã. Clique nele para ver quais contas precisam de atenção urgente!',
    position: 'bottom',
  },
  {
    id: 'pending',
    target: '[data-nav="pending"]',
    title: '💸 Contas a Pagar',
    description: 'Aqui você registra tudo que ainda precisa pagar: aluguel, fornecedores, contas em geral. Cadastre com a data de vencimento e o sistema vai te lembrar quando estiver próximo. Você também pode importar um boleto em PDF e o sistema preenche tudo automaticamente!',
    position: 'right',
  },
  {
    id: 'pending-recorrente',
    target: '[data-nav="pending"]',
    title: '🔄 Contas Recorrentes',
    description: 'Ao registrar uma conta a pagar, existe a opção "Pagamento Recorrente". Marque essa caixinha para contas fixas como aluguel e assinaturas — quando você der baixa (pagar), o sistema já cria automaticamente a mesma conta para o próximo mês!',
    position: 'right',
  },
  {
    id: 'receivable',
    target: '[data-nav="receivable"]',
    title: '💰 Contas a Receber',
    description: 'Nesta seção você registra valores que irá receber: pagamentos de clientes, serviços prestados etc. Assim você tem controle do que está previsto entrar no seu caixa e a visão fica completa no Dashboard.',
    position: 'right',
  },
  {
    id: 'expenses',
    target: '[data-nav="expenses"]',
    title: '🧾 Histórico de Despesas Pagas',
    description: 'Aqui ficam registradas todas as despesas que já foram pagas. Você pode adicionar uma despesa direto aqui, ou ela cai aqui automaticamente quando você dá baixa em uma conta da tela "A Pagar".',
    position: 'right',
  },
  {
    id: 'attachment',
    target: '[data-nav="expenses"]',
    title: '📎 Anexar Comprovantes',
    description: 'Na tabela de Histórico Pago, cada linha tem um ícone de clipe. Clique nele para anexar a foto ou PDF do comprovante/nota fiscal daquela despesa. O arquivo fica salvo e vinculado para sempre à transação!',
    position: 'right',
  },
  {
    id: 'calendar',
    target: '[data-nav="calendar"]',
    title: '📅 Calendário Financeiro',
    description: 'O calendário mostra visualmente todas as suas contas a pagar e a receber no mês. Dias com contas ficam marcados, ajudando você a planejar seu fluxo de caixa com antecedência.',
    position: 'right',
  },
  {
    id: 'pdf',
    target: '.topbar',
    title: '📄 Exportar Relatório em PDF',
    description: 'No Dashboard, existe o botão "Exportar Relatório". Clicando nele, o sistema gera um PDF profissional com o resumo do mês, gastos por categoria e tabela de todas as despesas. Perfeito para enviar para o seu contador!',
    position: 'bottom',
  },
  {
    id: 'settings',
    target: '[data-nav="settings"]',
    title: '⚙️ Configurações',
    description: 'Nas configurações você cadastra suas Categorias de gastos (ex: "Fornecedores", "Aluguel", "Impostos") e seus Fornecedores com CNPJ. Esses cadastros aparecem como opção na hora de registrar uma despesa, deixando os relatórios muito mais organizados!',
    position: 'right',
  },
  {
    id: 'finish',
    target: '.sidebar-header',
    title: '🎉 Pronto! Você conhece o sistema!',
    description: 'Agora você sabe tudo sobre o Magalhaes Inteligencia! Lembre-se: você pode desativar este tutorial nas Configurações, na seção "Tutorial & Ajuda". Qualquer dúvida, é só reativar o tutorial por lá. Bom trabalho! 💪',
    position: 'right',
  },
];

export default function Tutorial({ onFinish }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);

  const currentStep = STEPS[step];

  useEffect(() => {
    if (!visible) return;
    const el = document.querySelector(currentStep.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step, visible, currentStep.target]);

  const handleClose = () => {
    setVisible(false);
    onFinish?.();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  // Calcula posição do tooltip
  const getTooltipStyle = () => {
    if (!targetRect || currentStep.position === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        width: 380,
      };
    }

    const pad = 20;
    if (currentStep.position === 'right') {
      return {
        position: 'fixed',
        top: Math.min(targetRect.top, window.innerHeight - 280),
        left: targetRect.right + pad,
        zIndex: 10001,
        width: 340,
      };
    }
    if (currentStep.position === 'bottom') {
      return {
        position: 'fixed',
        top: targetRect.bottom + pad,
        right: 24,
        zIndex: 10001,
        width: 340,
      };
    }
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10001,
      width: 380,
    };
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <>
      {/* Overlay escuro com "buraco" no elemento atual */}
      <div
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 10000,
          pointerEvents: 'none',
        }}
      />

      {/* Destaque do elemento alvo */}
      {targetRect && currentStep.position !== 'center' && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            border: '2px solid #4f70e8',
            zIndex: 10000,
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          }}
        />
      )}

      {/* Tooltip do tutorial */}
      <div
        ref={tooltipRef}
        style={{
          ...getTooltipStyle(),
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #243b9d 0%, #1a2a6c 100%)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white' }}>
            <GraduationCap size={18} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tutorial — Passo {step + 1} de {STEPS.length}
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '4px 8px', color: 'white', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
            title="Pular tutorial"
          >
            <X size={14} /> Pular
          </button>
        </div>

        {/* Barra de progresso */}
        <div style={{ height: 3, background: '#e5e7eb' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #243b9d, #4f70e8)',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
            {currentStep.title}
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.7, margin: 0 }}>
            {currentStep.description}
          </p>
        </div>

        {/* Botões de navegação */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <button
            onClick={handlePrev}
            disabled={step === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0.5rem 1rem', borderRadius: 8,
              border: '1px solid #e2e8f0', background: 'white',
              color: step === 0 ? '#cbd5e1' : '#475569',
              cursor: step === 0 ? 'default' : 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          {/* Pontos de progresso */}
          <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? '#243b9d' : i < step ? '#93c5fd' : '#e2e8f0',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>

          <button
            onClick={handleNext}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0.5rem 1.25rem', borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #243b9d, #1a2a6c)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 700,
              boxShadow: '0 4px 12px rgba(36,59,157,0.3)',
            }}
          >
            {step === STEPS.length - 1 ? '🎉 Concluir' : 'Próximo'} <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.92) ${currentStep.position === 'center' ? 'translate(-50%,-50%)' : ''}; }
          to   { opacity: 1; transform: scale(1)    ${currentStep.position === 'center' ? 'translate(-50%,-50%)' : ''}; }
        }
      `}</style>
    </>
  );
}
