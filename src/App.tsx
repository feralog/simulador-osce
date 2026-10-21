import React, { useState, useEffect } from 'react';
import {
  Heart,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Layers,
  BookOpen,
  Info,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  Award,
} from 'lucide-react';
import { SCENARIOS, generateRandomScenario } from './simulator/scenarios';
import type {
  ClinicalScenario,
  ScenarioPhase,
  SimulationMode,
  Tec5600State,
  MoveStatus,
  OsascoStatus,
  CagadaStatus,
  PatientVitals,
  RhythmType,
} from './simulator/types';
import { validateCardioversion, validatePacerCapture } from './simulator/clinicalLogic';
import { soundEngine } from './simulator/audio';
import { MultiparameterMonitor } from './components/MultiparameterMonitor';
import { CardiolifeTec5600 } from './components/CardiolifeTec5600';
import { OsceQuestionPanel } from './components/OsceQuestionPanel';
import { ClinicalActionsBar } from './components/ClinicalActionsBar';

export default function App() {
  // Mode selection & Active Scenario
  const [mode, setMode] = useState<SimulationMode>('megacode');
  const [scenarioList, setScenarioList] = useState<ClinicalScenario[]>(SCENARIOS);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SCENARIOS[0].id);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState<number>(0);

  // Active scenario object
  const currentScenario =
    scenarioList.find((s) => s.id === selectedScenarioId) || scenarioList[0];
  const currentPhase: ScenarioPhase =
    currentScenario.phases[currentPhaseIndex] || currentScenario.phases[0];

  // Dynamic Patient Vitals and Rhythm (copied from current phase, modifiable during simulation)
  const [vitals, setVitals] = useState<PatientVitals>(currentPhase.vitals);
  const [rhythm, setRhythm] = useState<RhythmType>(currentPhase.rhythm);

  // Defibrillator / Pacemaker TEC-5600 State
  const [tecState, setTecState] = useState<Tec5600State>({
    knobPosition: 'MONITOR',
    syncEnabled: false,
    isCharging: false,
    isCharged: false,
    chargedJoules: 0,
    chargeProgress: 0,
    paddlesConnected: true,
    leadSelected: 'DII',
    pacerActive: false,
    pacerRatePPM: 70,
    pacerCurrentMA: 20,
  });

  // Checklist Protocols State
  const [move, setMove] = useState<MoveStatus>({
    monitor: true,
    oxygen: false,
    venoclysis: false,
    exams: false,
  });

  const [osasco, setOsasco] = useState<OsascoStatus>({
    orientar: false,
    sedar: false,
    ambusar: false,
    sincronizar: false,
    cardioverter: false,
    observar: false,
  });

  const [cagada, setCagada] = useState<CagadaStatus>({
    cabos: false,
    aumentarGanho: false,
    derivacao: false,
  });

  // Monitor Settings
  const [cagadaLead, setCagadaLead] = useState<'DII' | 'DI' | 'DIII'>('DII');
  const [cagadaGain, setCagadaGain] = useState<number>(1.0);
  const [isNIBPMeasuring, setIsNIBPMeasuring] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // CPR and Evaluation state
  const [cprCycleCount, setCprCycleCount] = useState<number>(1);
  const [feedbackLog, setFeedbackLog] = useState<{ id: string; text: string; isError?: boolean }[]>([
    {
      id: 'init',
      text: 'Simulador iniciado. Analise o caso clínico, monitore os sinais vitais e responda à pergunta da estação da OSCE.',
    },
  ]);
  const [showReferenceGuide, setShowReferenceGuide] = useState<boolean>(false);

  // Sync vitals and rhythm when switching scenario or phase
  useEffect(() => {
    setVitals(currentPhase.vitals);
    setRhythm(currentPhase.rhythm);
    setOsasco({
      orientar: false,
      sedar: false,
      ambusar: false,
      sincronizar: false,
      cardioverter: false,
      observar: false,
    });
  }, [currentPhase]);

  // Log feedback helper
  const addFeedback = (text: string, isError: boolean = false) => {
    setFeedbackLog((prev) => [{ id: Math.random().toString(), text, isError }, ...prev.slice(0, 4)]);
  };

  // Check Pacemaker capture threshold dynamically
  const pacerThreshold = currentPhase.pacerThresholdMA || 65;
  const pacerCapture =
    tecState.pacerActive &&
    (tecState.knobPosition === 'MARCAPASSO_DEMANDA' || tecState.knobPosition === 'MARCAPASSO_FIXO') &&
    tecState.pacerCurrentMA >= pacerThreshold;

  // React to pacemaker capture: when threshold is reached, stabilize patient!
  useEffect(() => {
    if (pacerCapture) {
      soundEngine.playPacerClick();
      setRhythm('paced');
      setVitals((prev) => ({
        ...prev,
        heartRate: tecState.pacerRatePPM,
        systolicBP: 105,
        diastolicBP: 68,
        hasPulse: true,
        consciousness: 'alert',
        shockSigns: false,
      }));
      addFeedback(`⚡ CAPTURA DO MARCA-PASSO ALCANÇADA a ${tecState.pacerCurrentMA} mA! Espícula seguida de QRS largo. Pulso mecânico confirmado a ${tecState.pacerRatePPM} bpm!`);
    } else if (tecState.pacerActive && tecState.pacerCurrentMA < pacerThreshold && currentPhase.rhythm === 'bav_3_bavt') {
      // Revert back if mA turned down
      setRhythm('bav_3_bavt');
      setVitals(currentPhase.vitals);
    }
  }, [pacerCapture, tecState.pacerRatePPM, tecState.pacerCurrentMA]);

  // Handle Shock Delivery from TEC-5600
  const handleDeliverShock = () => {
    const joules = tecState.chargedJoules || tecState.chargeProgress;

    const validation = validateCardioversion({
      rhythm,
      hasPulse: vitals.hasPulse,
      selectedEnergy: joules,
      syncEnabled: tecState.syncEnabled,
      isSedated: osasco.sedar,
      isOxygenated: move.oxygen,
    });

    if (!validation.success) {
      if (validation.inducedFV) {
        // R on T phenomenon!
        setRhythm('fv_grosseira');
        setVitals({
          heartRate: 0,
          systolicBP: 0,
          diastolicBP: 0,
          spO2: 60,
          respiratoryRate: 0,
          etCO2: 10,
          consciousness: 'unresponsive',
          hasPulse: false,
          chestPain: false,
          dyspnea: false,
          shockSigns: true,
        });
        addFeedback(validation.message, true);
        addFeedback('🚨 FENÔMENO R-SOBRE-T OCORREU! O paciente degenerou para Fibrilação Ventricular (PCR)! Inicie RCP e desfibrilação 200J imediatamente!', true);
      } else {
        addFeedback(validation.message, true);
      }
      return;
    }

    // Success in shock!
    addFeedback(validation.message);
    setOsasco((prev) => ({ ...prev, cardioverter: true, observar: true }));

    // If it was a shockable PCR (FV / TVSP)
    if (!vitals.hasPulse && (rhythm === 'fv_grosseira' || rhythm === 'tv_monomorfica')) {
      addFeedback('Choque de desfibrilação disparado! Reinicie imediatamente as compressões torácicas por 2 minutos (não checar pulso agora).');
      // After CPR cycle or advancement, conversion will occur
    }
    // If it was a synchronized cardioversion of TSV / FA
    else if (vitals.hasPulse) {
      setRhythm('sinus_normal');
      setVitals({
        heartRate: 75,
        systolicBP: 120,
        diastolicBP: 75,
        spO2: 97,
        respiratoryRate: 16,
        etCO2: 38,
        consciousness: 'alert',
        hasPulse: true,
        chestPain: false,
        dyspnea: false,
        shockSigns: false,
      });
      addFeedback('✨ SUCESSO! Taquiarritmia revertida para Ritmo Sinusal após cardioversão elétrica sincronizada! Pulso carotídeo palpável e paciente estabilizado.');
    }
  };

  // Check Pulse Handler (10 seconds OSCE check)
  const handleCheckPulse = () => {
    soundEngine.playClick();
    if (vitals.hasPulse) {
      addFeedback(`Pulso carotídeo presente, rítmico e cheio (~${vitals.heartRate} bpm).`);
    } else {
      soundEngine.playAlarmBeep();
      addFeedback('⚠️ PULSO CAROTÍDEO AUSENTE! Paciente em Parada Cardiorrespiratória (PCR)! Chame ajuda, inicie RCP imediatamente e traga o desfibrilador.', true);
    }
  };

  // Administer Drug Handler
  const handleAdministerDrug = (drug: string, dose: string, note?: string) => {
    soundEngine.playClick();
    addFeedback(`💉 Medicamento administrado: ${drug} (${dose}). ${note || ''}`);

    // Clinical response logic
    if (drug.includes('Adenosina') && rhythm === 'tsv' && vitals.hasPulse) {
      // Reversion of TSV to Sinus rhythm
      setTimeout(() => {
        setRhythm('sinus_normal');
        setVitals((prev) => ({
          ...prev,
          heartRate: 72,
          systolicBP: 118,
          diastolicBP: 76,
        }));
        addFeedback('✨ Adenosina em bolus rápido causou pausa transitória e reverteu a TPSV para Ritmo Sinusal regular!');
      }, 1500);
    }
  };

  // Advance CPR Cycle (2 min)
  const handleAdvanceCprCycle = () => {
    soundEngine.playClick();
    const nextCycle = cprCycleCount + 1;
    setCprCycleCount(nextCycle);
    addFeedback(`⏱️ Ciclo ${cprCycleCount} encerrado (2 minutos decorridos). Interrompa brevemente a massagem (< 10s) para checar o ritmo no monitor e o pulso!`);

    // In Megacode 1 or 2: if in FV or TV, progress to next rhythm state
    if (currentScenario.id === 'megacode-1' && currentPhase.phaseNumber === 2) {
      setRhythm('aesp');
      setVitals({
        heartRate: 60,
        systolicBP: 0,
        diastolicBP: 0,
        spO2: 65,
        respiratoryRate: 0,
        etCO2: 12,
        consciousness: 'unresponsive',
        hasPulse: false,
        chestPain: false,
        dyspnea: false,
        shockSigns: true,
      });
      addFeedback('Ritmo no monitor mudou para ritmo organizado lento (60 bpm), mas PULSO CONTINUA AUSENTE: Paciente em AESP! Inicie RCP + Epinefrina 1 mg e investigue os 5 Hs e 5 Ts.');
    } else if (currentScenario.id === 'megacode-1' && currentPhase.phaseNumber === 3) {
      // RCE!
      setRhythm('sinus_normal');
      setVitals({
        heartRate: 80,
        systolicBP: 98,
        diastolicBP: 64,
        spO2: 96,
        respiratoryRate: 14,
        etCO2: 44,
        consciousness: 'somnolent',
        hasPulse: true,
        chestPain: false,
        dyspnea: false,
        shockSigns: false,
      });
      addFeedback('🎉 SALTO NA CAPNOGRAFIA (> 40 mmHg)! Pulso carotídeo palpável e pressão arterial mensurável! RCE (Retorno da Circulação Espontânea) ALCANÇADO!');
    }
  };

  // NIBP Manual trigger
  const handleTriggerNIBP = () => {
    setIsNIBPMeasuring(true);
    addFeedback('Manguito de pressão insuflado... medindo pressão arterial não-invasiva.');
    setTimeout(() => {
      setIsNIBPMeasuring(false);
      if (vitals.hasPulse) {
        addFeedback(`PANI Aferida: ${vitals.systolicBP}/${vitals.diastolicBP} mmHg (PAM ${Math.round((vitals.systolicBP + 2 * vitals.diastolicBP) / 3)} mmHg).`);
      } else {
        addFeedback('PANI Aferida: Pressão arterial INAUDÍVEL (sem pulso palpável).', true);
      }
    }, 2000);
  };

  // Sound toggle
  const handleToggleSound = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
  };

  // Filter scenarios based on category
  const megacodeScenarios = SCENARIOS.filter((s) => s.category === 'megacode');
  const focusedScenarios = SCENARIOS.filter((s) => s.category !== 'megacode');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-12">
      {/* Top Application Navbar */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-2.5 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Heart className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>Simulador OSCE Emergência</span>
              <span className="text-[10px] bg-indigo-950 border border-indigo-700/60 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                Alta Fidelidade • TEC-5600
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Monitor Multiparamétrico • Desfibrilador Nihon Kohden • Protocolos MOVE, OSASCO &amp; PCR
            </p>
          </div>
        </div>

        {/* Mode Selector & Quick Tools */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-xl border transition ${
              soundMuted
                ? 'bg-red-950/80 border-red-700 text-red-300'
                : 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
            }`}
            title={soundMuted ? 'Ativar Áudio Clínico' : 'Mutar Áudio'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Reference Slides Guide Button */}
          <button
            onClick={() => setShowReferenceGuide(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Guia da Aula &amp; Slides</span>
          </button>

          {/* Reset / Novo Caso Aleatório */}
          <button
            onClick={() => {
              const randomCase = generateRandomScenario();
              setScenarioList([randomCase, ...SCENARIOS]);
              setSelectedScenarioId(randomCase.id);
              setCurrentPhaseIndex(0);
              addFeedback('🎲 Novo caso clínico de simulação aleatória gerado!');
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sorteador de Caso</span>
          </button>
        </div>
      </header>

      {/* Mode Tabs Navigation */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Modo de Estudo:
          </span>

          {/* Megacode Selector */}
          <button
            onClick={() => {
              setMode('megacode');
              setSelectedScenarioId(megacodeScenarios[0].id);
              setCurrentPhaseIndex(0);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              mode === 'megacode'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Megacode Evolutivo
          </button>

          {/* Focused Stations Selector */}
          <button
            onClick={() => {
              setMode('focused');
              setSelectedScenarioId(focusedScenarios[0].id);
              setCurrentPhaseIndex(0);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              mode === 'focused'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Casos Focados / Rápidos
          </button>
        </div>

        {/* Dropdown for specific case within mode */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Cenário:</span>
          <select
            value={selectedScenarioId}
            onChange={(e) => {
              setSelectedScenarioId(e.target.value);
              setCurrentPhaseIndex(0);
            }}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {(mode === 'megacode' ? megacodeScenarios : focusedScenarios).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4 flex-1 w-full">
        {/* Real-time Feedback Ticker */}
        {feedbackLog.length > 0 && (
          <div
            className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border shadow-sm ${
              feedbackLog[0].isError
                ? 'bg-rose-950/80 border-rose-700 text-rose-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackLog[0].isError ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              )}
              <span className="leading-snug">{feedbackLog[0].text}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">Última ação</span>
          </div>
        )}

        {/* Side-by-Side Medical Hardware: Multiparameter Monitor & TEC-5600 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Multiparameter Monitor (7 cols on large screens) */}
          <div className="xl:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
              <span>Monitor Multiparamétrico Clínico</span>
              <span className="font-mono text-emerald-400">Tempo Real • Varredura Contínua</span>
            </div>
            <MultiparameterMonitor
              vitals={vitals}
              rhythm={rhythm}
              syncEnabled={tecState.syncEnabled}
              pacerCapture={pacerCapture}
              isNIBPMeasuring={isNIBPMeasuring}
              onTriggerNIBP={handleTriggerNIBP}
              cagadaLead={cagadaLead}
              onChangeLead={(lead) => {
                setCagadaLead(lead);
                addFeedback(`Derivação do monitor alterada para ${lead}.`);
              }}
              cagadaGain={cagadaGain}
              onChangeGain={(gain) => {
                setCagadaGain(gain);
                addFeedback(`Ganho do traçado alterado para x${gain}.`);
              }}
              soundMuted={soundMuted}
              onToggleSound={handleToggleSound}
            />
          </div>

          {/* Nihon Kohden Cardiolife TEC-5600 Console (5 cols on large screens) */}
          <div className="xl:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
              <span>Desfibrilador &amp; Cardioversor Nihon Kohden TEC-5600</span>
              <span className="font-mono text-orange-400">Controles Interativos</span>
            </div>
            <CardiolifeTec5600
              state={tecState}
              rhythm={rhythm}
              hasPulse={vitals.hasPulse}
              onUpdateState={setTecState}
              onDeliverShock={handleDeliverShock}
              onFeedback={addFeedback}
            />
          </div>
        </div>

        {/* Lower Row: Clinical Actions Toolbar & OSCE Hybrid Question Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Clinical Actions & Medications (6 cols) */}
          <div className="lg:col-span-6">
            <ClinicalActionsBar
              vitals={vitals}
              rhythm={rhythm}
              move={move}
              osasco={osasco}
              cagada={cagada}
              onUpdateMove={(k) => setMove((prev) => ({ ...prev, [k]: !prev[k] }))}
              onUpdateOsasco={(k) => setOsasco((prev) => ({ ...prev, [k]: !prev[k] }))}
              onUpdateCagada={(k) => setCagada((prev) => ({ ...prev, [k]: !prev[k] }))}
              onCheckPulse={handleCheckPulse}
              onAdministerDrug={handleAdministerDrug}
              onAdvanceCprCycle={handleAdvanceCprCycle}
              cprCycleCount={cprCycleCount}
              onFeedback={addFeedback}
            />
          </div>

          {/* OSCE Question & Scenario Narrative (6 cols) */}
          <div className="lg:col-span-6">
            <OsceQuestionPanel
              scenario={currentScenario}
              currentPhase={currentPhase}
              hasNextPhase={currentPhaseIndex < currentScenario.phases.length - 1}
              onAdvancePhase={() => {
                if (currentPhaseIndex < currentScenario.phases.length - 1) {
                  setCurrentPhaseIndex((prev) => prev + 1);
                  addFeedback(`Avançado para Fase ${currentPhaseIndex + 2} do caso clínico.`);
                }
              }}
              onSelectOption={(optId, isCorrect) => {
                if (isCorrect) {
                  soundEngine.playChargedReadyTone();
                  addFeedback('✅ Alternativa correta assinalada na questão da OSCE!');
                } else {
                  soundEngine.playAlarmBeep();
                  addFeedback('❌ Alternativa incorreta. Leia a justificativa e tente novamente.', true);
                }
              }}
            />
          </div>
        </div>
      </main>

      {/* Reference Slides Modal / Drawer */}
      {showReferenceGuide && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-3xl w-full p-5 text-slate-200 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-lg text-white">
                  Resumo das Aulas Práticas: Arritmias e PCR (UNISA)
                </h3>
              </div>
              <button
                onClick={() => setShowReferenceGuide(false)}
                className="text-slate-400 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
              {/* Box 1: MOVE e Instabilidade */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-sky-300 text-sm">Abordagem Inicial</h4>
                <p>
                  <strong>Se o paciente se MOVE:</strong> Iniciar MOVE (Monitor, Oxigênio, Venóclise, Exames) + ABCDE + Verificar Estabilidade.
                </p>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="font-bold text-rose-300">Critérios de Instabilidade (5):</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300">
                    <li>PAS &lt; 90 mmHg (hipotensão)</li>
                    <li>Rebaixamento do nível de consciência</li>
                    <li>Sinais de choque (hipoperfusão)</li>
                    <li>Dor torácica de padrão isquêmico</li>
                    <li>Dispneia / congestão</li>
                  </ul>
                </div>
              </div>

              {/* Box 2: Protocolo OSASCO */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-orange-400 text-sm">Protocolo OSASCO (Cardioversão)</h4>
                <ul className="space-y-1 text-slate-300">
                  <li><strong>O</strong> = Orientar o paciente</li>
                  <li><strong>S</strong> = Sedar / analgesiar (Etomidato / Midazolam + Fentanil)</li>
                  <li><strong>A</strong> = Ambusar / pré-oxigenar a 100%</li>
                  <li><strong>S</strong> = Selecionar carga (100J) e Sincronizar (SINC)</li>
                  <li><strong>C</strong> = Cardioverter (afastar todos e disparar)</li>
                  <li><strong>O</strong> = Observar ritmo e palpar pulso carotídeo imediatamente</li>
                </ul>
              </div>

              {/* Box 3: Bradicardias e Marca-passo TEC-5600 */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-emerald-400 text-sm">Bradiarritmias e Marca-passo</h4>
                <p>
                  • <strong>Atropina 1 mg</strong> a cada 3-5 min (máx 3 mg). <em>Atenção: NÃO funciona em BAVT!</em>
                </p>
                <p>
                  • <strong>Marca-passo Transcutâneo TEC-5600:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
                  <li>Colocar as pás multifunção</li>
                  <li>Girar seletor para função MP (Demanda/Fixo)</li>
                  <li>Ajustar FC de estimulação (60-80 ppm)</li>
                  <li>Iniciar estimulação e subir corrente (mA) até haver captura</li>
                  <li>Administrar morfina/sedação para analgesia da dor</li>
                </ol>
              </div>

              {/* Box 4: Protocolo CAGADA na Assistolia */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-rose-400 text-sm">Assistolia e Protocolo CAGADA</h4>
                <p>
                  Diante de linha reta no monitor, NUNCA chocar! Confirmar pelo mnemônico CAGADA:
                </p>
                <ul className="space-y-1 text-slate-300">
                  <li><strong>CA</strong> = Cabos checados (conexão das derivações)</li>
                  <li><strong>GA</strong> = Ganho aumentado no monitor (descartar FV fina)</li>
                  <li><strong>DA</strong> = Derivação trocada (DII para DI ou DIII)</li>
                </ul>
                <p className="text-amber-300 mt-1">
                  Confirmada: RCP contínua + Epinefrina 1 mg imediata + investigar 5 Hs e 5 Ts.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowReferenceGuide(false)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-xs transition"
              >
                Voltar à Simulação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
