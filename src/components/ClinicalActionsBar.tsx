import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Activity,
  Wind,
  Droplet,
  FileText,
  UserCheck,
  Bell,
  Pill,
  Timer,
  CheckCircle,
  HelpCircle,
  Play,
  Pause,
  AlertOctagon,
} from 'lucide-react';
import type { MoveStatus, OsascoStatus, CagadaStatus, PatientVitals, RhythmType } from '../simulator/types';
import { soundEngine } from '../simulator/audio';
import { validateAtropine } from '../simulator/clinicalLogic';

interface Props {
  vitals: PatientVitals;
  rhythm: RhythmType;
  move: MoveStatus;
  osasco: OsascoStatus;
  cagada: CagadaStatus;
  onUpdateMove: (key: keyof MoveStatus) => void;
  onUpdateOsasco: (key: keyof OsascoStatus) => void;
  onUpdateCagada: (key: keyof CagadaStatus) => void;
  onCheckPulse: () => void;
  onAdministerDrug: (drug: string, dose: string, note?: string) => void;
  onAdvanceCprCycle: () => void;
  cprCycleCount: number;
  onFeedback: (msg: string, isError?: boolean) => void;
}

export const ClinicalActionsBar: React.FC<Props> = ({
  vitals,
  rhythm,
  move,
  osasco,
  cagada,
  onUpdateMove,
  onUpdateOsasco,
  onUpdateCagada,
  onCheckPulse,
  onAdministerDrug,
  onAdvanceCprCycle,
  cprCycleCount,
  onFeedback,
}) => {
  const [cprActive, setCprActive] = useState<boolean>(false);
  const [cprSeconds, setCprSeconds] = useState<number>(0);
  const [atropineCount, setAtropineCount] = useState<number>(0);
  const [showHsTsModal, setShowHsTsModal] = useState<boolean>(false);
  const [showValsalvaModal, setShowValsalvaModal] = useState<boolean>(false);
  const [valsalvaStep, setValsalvaStep] = useState<number>(0);

  // CPR Metronome (110 bpm) and 2-min timer
  useEffect(() => {
    let metronome: NodeJS.Timeout;
    let timer: NodeJS.Timeout;

    if (cprActive) {
      // 110 bpm = 545ms interval
      metronome = setInterval(() => {
        soundEngine.playCprClick();
      }, 545);

      timer = setInterval(() => {
        setCprSeconds((s) => s + 1);
      }, 1000);
    }

    return () => {
      clearInterval(metronome);
      clearInterval(timer);
    };
  }, [cprActive]);

  const handleToggleCpr = () => {
    soundEngine.playClick();
    if (!cprActive) {
      setCprActive(true);
      onFeedback('Massagem Cardíaca iniciada! Frequência 100-120/min, depressão de 5-6 cm, retorno total do tórax e interrupções mínimas (< 10s).');
    } else {
      setCprActive(false);
      onFeedback('RCP pausada para checagem de ritmo/pulso.');
    }
  };

  const handleAtropine = () => {
    const val = validateAtropine(rhythm, atropineCount);
    if (!val.isIndicated) {
      onFeedback(val.message, true);
      return;
    }
    setAtropineCount((c) => c + 1);
    onAdministerDrug('Atropina', '1 mg IV bolus rápido', `Dose ${atropineCount + 1} de 3 mg máxima.`);
    onFeedback(val.message);
  };

  return (
    <div className="bg-slate-900 border-2 border-slate-700/80 rounded-2xl p-3.5 shadow-xl space-y-3 font-sans text-xs">
      {/* Action Sections Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-rose-400" />
          <span className="font-bold text-sm text-white">Painel de Ações Médicas e Condutas OSCE</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHsTsModal(true)}
            className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
          >
            <HelpCircle className="w-3.5 h-3.5" /> 5 Hs e 5 Ts
          </button>
        </div>
      </div>

      {/* Row 1: Protocolo MOVE & Avaliação Primária */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>1. Abordagem Inicial: MOVE & Avaliação</span>
          <span className="text-[10px] text-slate-400">Clique para executar</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
          {/* M - Monitor */}
          <button
            onClick={() => {
              onUpdateMove('monitor');
              onFeedback('M - Monitorização instalada: ECG contínuo em DII, oxímetro de pulso e PANI.');
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center font-semibold transition ${
              move.monitor
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px]">M - Monitor</span>
            {move.monitor && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </button>

          {/* O - Oxigênio */}
          <button
            onClick={() => {
              onUpdateMove('oxygen');
              onFeedback('O - Oxigenioterapia suplementar iniciada (cateter nasal / máscara não-reinalante se Sat < 94%).');
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center font-semibold transition ${
              move.oxygen
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Wind className="w-4 h-4 text-sky-400" />
            <span className="text-[10px]">O - Oxigênio</span>
            {move.oxygen && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </button>

          {/* V - Venóclise */}
          <button
            onClick={() => {
              onUpdateMove('venoclysis');
              onFeedback('V - Venóclise garantida: acesso venoso periférico calibroso Jelco 18G em membro superior.');
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center font-semibold transition ${
              move.venoclysis
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Droplet className="w-4 h-4 text-rose-400" />
            <span className="text-[10px]">V - Venóclise</span>
            {move.venoclysis && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </button>

          {/* E - Exames */}
          <button
            onClick={() => {
              onUpdateMove('exams');
              onFeedback('E - Exames solicitados: ECG de 12 derivações, troponina, eletrólitos e gasometria.');
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center font-semibold transition ${
              move.exams
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-[10px]">E - Exames</span>
            {move.exams && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </button>

          {/* Checar Pulso (10s) */}
          <button
            onClick={onCheckPulse}
            className="p-2 rounded-xl border bg-slate-800/90 hover:bg-slate-800 border-indigo-700/60 text-indigo-200 flex flex-col items-center justify-center gap-1 text-center font-semibold transition active:scale-95"
          >
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px]">Checar Pulso</span>
          </button>

          {/* Chamar Ajuda / Carrinho */}
          <button
            onClick={() => {
              soundEngine.playAlarmBeep();
              onFeedback('🚨 Ajuda solicitada! Carrinho de parada com Desfibrilador TEC-5600 e equipe posicionada ao lado do leito.');
            }}
            className="p-2 rounded-xl border bg-slate-800/90 hover:bg-slate-800 border-amber-700/60 text-amber-200 flex flex-col items-center justify-center gap-1 text-center font-semibold transition active:scale-95"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-[10px]">Chamar Ajuda</span>
          </button>

          {/* Valsalva Modificada */}
          <button
            onClick={() => {
              setShowValsalvaModal(true);
              setValsalvaStep(1);
            }}
            className="p-2 rounded-xl border bg-slate-800/90 hover:bg-slate-800 border-purple-700/60 text-purple-200 flex flex-col items-center justify-center gap-1 text-center font-semibold transition active:scale-95"
          >
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-[10px]">Valsalva Modif.</span>
          </button>
        </div>
      </div>

      {/* Row 2: Protocolo OSASCO (Cardioversão) & CAGADA (Assistolia) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Protocolo OSASCO Box */}
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-[11px] text-orange-400 uppercase tracking-wide">
              Protocolo OSASCO (Cardioversão Elétrica)
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[10px]">
            <button
              onClick={() => {
                onUpdateOsasco('orientar');
                onFeedback('OSASCO [O]: Paciente orientado e tranquilizado sobre o procedimento.');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                osasco.orientar ? 'bg-orange-950 border-orange-500 text-orange-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>O</strong>: Orientar
            </button>
            <button
              onClick={() => {
                onUpdateOsasco('sedar');
                onFeedback('OSASCO [S]: Sedação e analgesia venosa rápida administradas (ex: Fentanil + Etomidato/Midazolam).');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                osasco.sedar ? 'bg-orange-950 border-orange-500 text-orange-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>S</strong>: Sedar
            </button>
            <button
              onClick={() => {
                onUpdateOsasco('ambusar');
                onFeedback('OSASCO [A]: Pré-oxigenação com bolsa-válvula-máscara a 100% realizada.');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                osasco.ambusar ? 'bg-orange-950 border-orange-500 text-orange-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>A</strong>: Ambusar
            </button>
            <button
              onClick={() => {
                onUpdateOsasco('sincronizar');
                onFeedback('OSASCO [S]: Carga selecionada e botão SINC ativado no cardioversor!');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                osasco.sincronizar ? 'bg-orange-950 border-orange-500 text-orange-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>S</strong>: Sincronizar
            </button>
            <button
              onClick={() => {
                onUpdateOsasco('cardioverter');
                onFeedback('OSASCO [C]: Disparo do choque com pás e aviso para todos se afastarem.');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                osasco.cardioverter ? 'bg-orange-950 border-orange-500 text-orange-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>C</strong>: Cardioverter
            </button>
            <button
              onClick={() => {
                onUpdateOsasco('observar');
                onFeedback('OSASCO [O]: Observado traçado pós-choque no monitor e palpado pulso carotídeo!');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                osasco.observar ? 'bg-orange-950 border-orange-500 text-orange-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>O</strong>: Observar
            </button>
          </div>
        </div>

        {/* Protocolo CAGADA Box (Assistolia) */}
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-[11px] text-rose-400 uppercase tracking-wide">
              Protocolo CAGADA (Confirmar Assistolia)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <button
              onClick={() => {
                onUpdateCagada('cabos');
                onFeedback('CAGADA [CA]: Cabos e eletrodos no tórax do paciente checados e fixados.');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                cagada.cabos ? 'bg-rose-950 border-rose-500 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>CA</strong> - Cabos Checados
            </button>
            <button
              onClick={() => {
                onUpdateCagada('aumentarGanho');
                onFeedback('CAGADA [GA]: Ganho aumentado para x2.0 no monitor para descartar FV fina.');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                cagada.aumentarGanho ? 'bg-rose-950 border-rose-500 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>GA</strong> - Ganho Aumentado
            </button>
            <button
              onClick={() => {
                onUpdateCagada('derivacao');
                onFeedback('CAGADA [DA]: Derivação mudada de DII para DI/DIII para confirmar linha reta em 2 eixos.');
              }}
              className={`p-1.5 rounded-lg border text-center transition ${
                cagada.derivacao ? 'bg-rose-950 border-rose-500 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <strong>DA</strong> - Derivação Trocada
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: RCP e Ciclos de 2 Minutos */}
      <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleCpr}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md ${
              cprActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {cprActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{cprActive ? 'Pausar RCP' : 'Iniciar Massagem RCP (110 bpm)'}</span>
          </button>

          <div className="font-mono text-xs text-slate-300">
            Tempo Ciclo:{' '}
            <span className="font-bold text-amber-400">
              {Math.floor(cprSeconds / 60)}:{(cprSeconds % 60).toString().padStart(2, '0')}
            </span>{' '}
            / 2:00 min
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            Ciclo Atual: <strong className="text-white">{cprCycleCount}</strong>
          </span>
          <button
            onClick={() => {
              setCprSeconds(0);
              onAdvanceCprCycle();
            }}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow transition"
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Avançar Ciclo (2 min)</span>
          </button>
        </div>
      </div>

      {/* Row 4: Farmácia de Emergência / Drogas */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Pill className="w-3.5 h-3.5 text-blue-400" />
          <span>Farmácia de Emergência (Doses Rápidas)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
          {/* Epinefrina 1mg */}
          <button
            onClick={() => onAdministerDrug('Epinefrina (Adrenalina)', '1 mg IV bolus + 20 mL SF', 'A cada 3 a 5 minutos na PCR.')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-center transition"
          >
            <div className="text-rose-400 font-bold">Epinefrina</div>
            <div className="text-[10px] text-slate-400">1 mg IV bolus</div>
          </button>

          {/* Amiodarona 300mg */}
          <button
            onClick={() => onAdministerDrug('Amiodarona', '300 mg IV bolus', '1ª dose após 3º choque na FV/TVSP.')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-center transition"
          >
            <div className="text-sky-400 font-bold">Amiodarona</div>
            <div className="text-[10px] text-slate-400">300 mg IV (1ª)</div>
          </button>

          {/* Amiodarona 150mg */}
          <button
            onClick={() => onAdministerDrug('Amiodarona', '150 mg IV bolus', '2ª dose na FV/TVSP refratária ou taquicardia com pulso.')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-center transition"
          >
            <div className="text-sky-400 font-bold">Amiodarona</div>
            <div className="text-[10px] text-slate-400">150 mg IV (2ª)</div>
          </button>

          {/* Atropina 1mg */}
          <button
            onClick={handleAtropine}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-center transition"
          >
            <div className="text-amber-400 font-bold">Atropina</div>
            <div className="text-[10px] text-slate-400">1 mg IV ({atropineCount}/3)</div>
          </button>

          {/* Adenosina 6mg */}
          <button
            onClick={() => onAdministerDrug('Adenosina', '6 mg IV bolus rápido + 20 mL SF', 'Torneirinha em bolus rápido + elevar membro.')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-center transition"
          >
            <div className="text-purple-400 font-bold">Adenosina</div>
            <div className="text-[10px] text-slate-400">6 mg IV bolus</div>
          </button>

          {/* Sedativo / Analgésico */}
          <button
            onClick={() => onAdministerDrug('Sedativo / Analgésico', 'Etomidato 0.3 mg/kg + Fentanil', 'Para sedação pré-cardioversão ou dor no marca-passo.')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-center transition"
          >
            <div className="text-emerald-400 font-bold">Sedação/Analgesia</div>
            <div className="text-[10px] text-slate-400">Fentanil/Etomidato</div>
          </button>
        </div>
      </div>

      {/* Modal 5 Hs e 5 Ts */}
      {showHsTsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 max-w-lg w-full text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-400" /> Causas Reversíveis de PCR (5 Hs e 5 Ts)
              </h3>
              <button
                onClick={() => setShowHsTsModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-sm text-sky-400">Os 5 Hs:</span>
                <ul className="space-y-1 text-slate-300">
                  <li>• <strong>Hipovolemia</strong> (expansão volêmica)</li>
                  <li>• <strong>Hipóxia</strong> (oxigenação e via aérea)</li>
                  <li>• <strong>Hidrogênio (acidose)</strong> (bicarbonato se indicado)</li>
                  <li>• <strong>Hipo / Hipercalemia</strong> (gluconato de cálcio / insulina)</li>
                  <li>• <strong>Hipotermia</strong> (reaquecimento ativo)</li>
                </ul>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-sm text-rose-400">Os 5 Ts:</span>
                <ul className="space-y-1 text-slate-300">
                  <li>• <strong>Tamponamento cardíaco</strong> (pericardiocentese)</li>
                  <li>• <strong>Trombose coronária (IAM)</strong> (cineangiocoronariografia)</li>
                  <li>• <strong>Toxinas</strong> (antídotos específicos)</li>
                  <li>• <strong>Tensão de tórax (Pneumotórax)</strong> (descompressão)</li>
                  <li>• <strong>Tromboembolismo Pulmonar (TEP)</strong> (trombolítico)</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowHsTsModal(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-xs"
            >
              Fechar Consulta
            </button>
          </div>
        </div>
      )}

      {/* Modal Manobra de Valsalva Modificada */}
      {showValsalvaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 max-w-md w-full text-slate-200 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-base text-white">Manobra de Valsalva Modificada</h3>
              <button
                onClick={() => setShowValsalvaModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Conforme demonstrado no slide 17 da aula prática, a manobra modificada é realizada em 3 tempos:
            </p>
            <div className="space-y-2 text-xs">
              <div className={`p-2.5 rounded-lg border ${valsalvaStep === 1 ? 'bg-indigo-950 border-indigo-500 text-indigo-200' : 'bg-slate-950 border-slate-800'}`}>
                <strong>1. 15 segundos:</strong> Paciente sentado a 45º sopra o êmbolo de uma seringa de 20 mL gerando pressão de 40 mmHg.
              </div>
              <div className={`p-2.5 rounded-lg border ${valsalvaStep === 2 ? 'bg-indigo-950 border-indigo-500 text-indigo-200' : 'bg-slate-950 border-slate-800'}`}>
                <strong>2. 15 segundos:</strong> Paciente deitado em decúbito dorsal enquanto o examinador eleva passivamente as pernas a 45º.
              </div>
              <div className={`p-2.5 rounded-lg border ${valsalvaStep === 3 ? 'bg-indigo-950 border-indigo-500 text-indigo-200' : 'bg-slate-950 border-slate-800'}`}>
                <strong>3. 30 segundos:</strong> Retorno à posição sentada com observação contínua do traçado no monitor.
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  if (valsalvaStep < 3) {
                    setValsalvaStep((s) => s + 1);
                  } else {
                    setShowValsalvaModal(false);
                    onFeedback('Manobra de Valsalva Modificada executada com técnica impecável! Observe o monitor para avaliar reversão.');
                  }
                }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-xs"
              >
                {valsalvaStep === 3 ? 'Concluir Manobra' : `Avançar Etapa (${valsalvaStep}/3)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
