import React, { useEffect, useState } from 'react';
import { Zap, Radio, Power, ArrowUp, ArrowDown, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { DefibrillatorKnobPosition, Tec5600State, RhythmType } from '../simulator/types';
import { soundEngine } from '../simulator/audio';

interface Props {
  state: Tec5600State;
  rhythm: RhythmType;
  hasPulse: boolean;
  onUpdateState: (updater: (prev: Tec5600State) => Tec5600State) => void;
  onDeliverShock: () => void;
  onFeedback: (msg: string, isError?: boolean) => void;
}

export const CardiolifeTec5600: React.FC<Props> = ({
  state,
  rhythm,
  hasPulse,
  onUpdateState,
  onDeliverShock,
  onFeedback,
}) => {
  const [shockAnimation, setShockAnimation] = useState(false);

  // Parse energy numeric value from knob position
  const getKnobJoules = (pos: DefibrillatorKnobPosition): number => {
    const match = pos.match(/(\d+)J/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const isPacerMode = state.knobPosition === 'MARCAPASSO_DEMANDA' || state.knobPosition === 'MARCAPASSO_FIXO';
  const isEnergySelected = getKnobJoules(state.knobPosition) > 0;
  const isOff = state.knobPosition === 'DESLIGADO';

  // Charging animation & sound
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state.isCharging) {
      soundEngine.startChargingSound();
      const startTime = Date.now();
      const duration = 2500; // 2.5 seconds capacitor charge time

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, Math.round((elapsed / duration) * 100));

        onUpdateState((prev) => ({
          ...prev,
          chargeProgress: progress,
        }));

        if (progress >= 100) {
          clearInterval(interval);
          soundEngine.stopChargingSound();
          soundEngine.playChargedReadyTone();
          onUpdateState((prev) => ({
            ...prev,
            isCharging: false,
            isCharged: true,
            chargedJoules: getKnobJoules(prev.knobPosition),
          }));
          onFeedback(`⚡ TEC-5600 CARREGADO: ${getKnobJoules(state.knobPosition)}J pronto para disparo! Certifique-se de que todos estão afastados do leito!`);
        }
      }, 50);

      return () => {
        clearInterval(interval);
        soundEngine.stopChargingSound();
      };
    }
  }, [state.isCharging]);

  // Periodic ready beep when charged
  useEffect(() => {
    let readyInterval: NodeJS.Timeout;
    if (state.isCharged) {
      readyInterval = setInterval(() => {
        soundEngine.playChargedReadyTone();
      }, 2000);
    }
    return () => clearInterval(readyInterval);
  }, [state.isCharged]);

  // Handle Rotary Knob Change
  const handleKnobChange = (newPos: DefibrillatorKnobPosition) => {
    soundEngine.playClick();
    onUpdateState((prev) => {
      // If was charged and position changed, disarm safely
      const wasCharged = prev.isCharged;
      return {
        ...prev,
        knobPosition: newPos,
        isCharging: false,
        isCharged: wasCharged && getKnobJoules(newPos) === prev.chargedJoules ? prev.isCharged : false,
        chargeProgress: 0,
        // If switched to OFF, stop pacer
        pacerActive: newPos === 'DESLIGADO' ? false : prev.pacerActive,
      };
    });
  };

  // Toggle SINC mode
  const handleToggleSync = () => {
    if (isOff) return;
    soundEngine.playClick();
    onUpdateState((prev) => {
      const nextSync = !prev.syncEnabled;
      if (nextSync) {
        onFeedback('Botão SINC ativado: O aparelho irá disparar sincronizado exclusivamente no pico da onda R (triângulos laranja no monitor).');
      } else {
        onFeedback('Botão SINC desativado: Choque NÃO sincronizado (modo desfibrilação para PCR).');
      }
      return {
        ...prev,
        syncEnabled: nextSync,
      };
    });
  };

  // Charge button (2)
  const handleCharge = () => {
    if (isOff) {
      onFeedback('O cardioversor está DESLIGADO. Gire a roda seletora para ligar.', true);
      return;
    }
    if (!isEnergySelected) {
      onFeedback('Selecione uma carga de energia em Joules (ex: 100J, 150J ou 200J) antes de carregar!', true);
      return;
    }
    if (state.isCharging || state.isCharged) return;

    soundEngine.playClick();
    onUpdateState((prev) => ({
      ...prev,
      isCharging: true,
      chargeProgress: 0,
    }));
  };

  // Shock button (3)
  const handleShock = () => {
    if (!state.isCharged) {
      onFeedback('Aperte o botão (2) CARGA primeiro e aguarde a carga completa!', true);
      return;
    }
    soundEngine.playShockDischarge();
    setShockAnimation(true);
    setTimeout(() => setShockAnimation(false), 500);

    onUpdateState((prev) => ({
      ...prev,
      isCharged: false,
      chargeProgress: 0,
    }));

    onDeliverShock();
  };

  // Disarm / Descarga interna
  const handleDisarm = () => {
    if (!state.isCharged && !state.isCharging) return;
    soundEngine.playClick();
    onUpdateState((prev) => ({
      ...prev,
      isCharging: false,
      isCharged: false,
      chargeProgress: 0,
    }));
    onFeedback('Carga cancelada e desarmada com segurança internamente.');
  };

  // Pacemaker controls
  const handleTogglePacer = () => {
    if (isOff) return;
    if (!isPacerMode) {
      onFeedback('Para usar o marca-passo, gire a roda seletora (1) para MARCA-PASSO (Demanda ou Fixo)!', true);
      return;
    }
    soundEngine.playClick();
    onUpdateState((prev) => {
      const nextActive = !prev.pacerActive;
      if (nextActive) {
        onFeedback(`Marca-passo transcutâneo INICIADO a ${prev.pacerRatePPM} ppm e ${prev.pacerCurrentMA} mA. Suba os miliamperes (mA) até obter captura elétrica e pulso!`);
      } else {
        onFeedback('Marca-passo transcutâneo PARADO.');
      }
      return {
        ...prev,
        pacerActive: nextActive,
      };
    });
  };

  const adjustPacerRate = (delta: number) => {
    soundEngine.playClick();
    onUpdateState((prev) => ({
      ...prev,
      pacerRatePPM: Math.max(30, Math.min(180, prev.pacerRatePPM + delta)),
    }));
  };

  const adjustPacerCurrent = (delta: number) => {
    soundEngine.playClick();
    onUpdateState((prev) => ({
      ...prev,
      pacerCurrentMA: Math.max(0, Math.min(200, prev.pacerCurrentMA + delta)),
    }));
  };

  const knobJoules = getKnobJoules(state.knobPosition);

  return (
    <div className={`relative bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-4 border-slate-400 rounded-2xl shadow-2xl p-4 text-slate-800 transition-all ${shockAnimation ? 'ring-8 ring-amber-400 animate-pulse' : ''}`}>
      {/* Top Nihon Kohden distinctive orange ergonomic handle */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-48 h-5 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 rounded-t-xl shadow-md border-t-2 border-orange-300 flex items-center justify-center">
        <span className="text-[10px] font-black tracking-widest text-white/90 drop-shadow">
          NIHON KOHDEN
        </span>
      </div>

      {/* Device Branding & Subtitle Header */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600" />
          <div>
            <h3 className="text-sm font-black tracking-wider text-slate-800 uppercase leading-none">
              Cardiolife TEC-5600
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wide">
              Biphasic Defibrillator / Pacemaker • ActiBiphasic
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pás Adesivas Conectadas
          </span>
        </div>
      </div>

      {/* Main Console Layout: 3 Columns (Left: Pacer Panel | Center: LCD Screen | Right: Knobs & Trigger) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: PACEMAKER PANEL (MARCAPASSO TEC-5600, Slides 10-11) */}
        {/* ============================================================== */}
        <div className="lg:col-span-3 bg-slate-800 rounded-xl p-2.5 text-white flex flex-col justify-between border-2 border-slate-700 shadow-inner">
          <div className="border-b border-slate-700 pb-1 mb-2 flex items-center justify-between">
            <span className="font-bold text-xs tracking-wider text-sky-400 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5" /> MARCAPASSO
            </span>
            <span className={`w-2.5 h-2.5 rounded-full ${state.pacerActive ? 'bg-emerald-400 shadow-md shadow-emerald-400 animate-ping' : 'bg-slate-600'}`} />
          </div>

          {/* INICIAR / PARAR Button (Green) */}
          <button
            onClick={handleTogglePacer}
            className={`w-full py-2 px-1 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 ${
              state.pacerActive
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 ring-2 ring-emerald-300'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{state.pacerActive ? 'PARAR ESTIMULAÇÃO' : 'INICIAR / PARAR'}</span>
          </button>

          {/* FC da Estimulação (ppm) */}
          <div className="mt-3 bg-slate-900 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-300 font-semibold mb-1 flex justify-between">
              <span>FREQ. ESTIMULAÇÃO</span>
              <span className="text-sky-300 font-mono">(ppm)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-mono font-black text-sky-400">
                {state.pacerRatePPM}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => adjustPacerRate(-5)}
                  className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 p-1 rounded border border-slate-600"
                  title="Diminuir FC ppm"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-slate-300" />
                </button>
                <button
                  onClick={() => adjustPacerRate(5)}
                  className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 p-1 rounded border border-slate-600"
                  title="Aumentar FC ppm"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-slate-300" />
                </button>
              </div>
            </div>
          </div>

          {/* Taxa de Estimulação / Corrente (mA) */}
          <div className="mt-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-300 font-semibold mb-1 flex justify-between">
              <span>CORRENTE / ENERGIA</span>
              <span className="text-amber-300 font-mono">(mA)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-mono font-black text-amber-400">
                {state.pacerCurrentMA}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => adjustPacerCurrent(-5)}
                  className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 p-1 rounded border border-slate-600"
                  title="Diminuir corrente mA"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-slate-300" />
                </button>
                <button
                  onClick={() => adjustPacerCurrent(5)}
                  className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 p-1 rounded border border-slate-600"
                  title="Aumentar corrente mA até captura"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-slate-300" />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 leading-tight">
              Suba a corrente até visualizar a espícula capturando o QRS e conferir pulso periférico!
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CENTER COLUMN: TEC-5600 CENTRAL LCD DISPLAY */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 bg-[#08121f] rounded-xl p-3 text-slate-100 flex flex-col justify-between border-4 border-slate-800 shadow-2xl relative overflow-hidden">
          {/* LCD Status Banner */}
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-bold text-slate-300">MODO:</span>
              <span className="text-sky-300 font-black">
                {isOff
                  ? 'DESLIGADO'
                  : isPacerMode
                  ? 'MARCAPASSO TRANSCUTÂNEO'
                  : state.knobPosition === 'DEA'
                  ? 'DEA AUTOMÁTICO'
                  : state.syncEnabled
                  ? 'CARDIOVERSÃO SINCRONIZADA'
                  : 'DESFIBRILAÇÃO MANUAL'}
              </span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
              Bateria 100%
            </span>
          </div>

          {/* LCD Screen Center Message */}
          <div className="my-auto py-3 text-center">
            {isOff ? (
              <div className="text-slate-500 font-mono text-sm py-8">
                APARELHO EM ESPERA (DESLIGADO)
                <div className="text-xs text-slate-600 mt-1">Gire o seletor (1) para iniciar</div>
              </div>
            ) : state.isCharged ? (
              <div className="space-y-1">
                <div className="inline-block bg-orange-500/20 text-orange-400 border border-orange-500 px-3 py-1 rounded-full text-xs font-black animate-pulse">
                  ⚡ CARGA COMPLETA: {state.chargedJoules} JOULES
                </div>
                <div className="text-xl font-black text-amber-300 font-mono tracking-wide">
                  PRONTO PARA CHOQUE!
                </div>
                <p className="text-xs text-rose-300 font-bold">
                  "AFASTE-SE DO PACIENTE!" • Aperte o botão (3) CHOQUE
                </p>
                {state.syncEnabled && (
                  <div className="text-[11px] text-orange-400 bg-orange-950/80 px-2 py-0.5 rounded inline-block font-mono">
                    ● Disparo sincronizado ao sensor da onda R
                  </div>
                )}
              </div>
            ) : state.isCharging ? (
              <div className="space-y-2">
                <div className="text-sm font-bold text-sky-300">CARREGANDO CAPACITOR...</div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-amber-400 h-full transition-all duration-75"
                    style={{ width: `${state.chargeProgress}%` }}
                  />
                </div>
                <div className="text-xs font-mono text-slate-300">
                  {state.chargeProgress}% ({Math.round((state.chargeProgress / 100) * knobJoules)}J)
                </div>
              </div>
            ) : isPacerMode ? (
              <div className="space-y-1">
                <div className="text-xs text-slate-400">STATUS MARCAPASSO</div>
                <div className="text-lg font-black text-sky-400 font-mono">
                  {state.pacerActive ? 'ESTIMULAÇÃO EM CURSO' : 'EM ESPERA (PARADO)'}
                </div>
                <div className="text-xs text-slate-300">
                  {state.pacerRatePPM} ppm • {state.pacerCurrentMA} mA
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-slate-400">ENERGIA SELECIONADA</div>
                <div className="text-3xl font-black text-white font-mono">
                  {knobJoules > 0 ? `${knobJoules} J` : state.knobPosition}
                </div>
                <div className="text-xs text-slate-300">
                  {state.syncEnabled
                    ? 'CARDIOVERSÃO SINCRONIZADA ATIVA (SINC)'
                    : isEnergySelected
                    ? 'DESFIBRILAÇÃO (NÃO SINCRONIZADA)'
                    : 'MODO MONITOR'}
                </div>
              </div>
            )}
          </div>

          {/* LCD Bottom Helper Information */}
          <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>PÁS MULTIFUNÇÃO: ADULTO</span>
            <span>IMPEDÂNCIA: 64 Ω (BOM)</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: ROTARY SELECTOR (1), CARGA (2), CHOQUE (3), SINC */}
        {/* ============================================================== */}
        <div className="lg:col-span-4 bg-slate-200 rounded-xl p-3 flex flex-col justify-between border-2 border-slate-300 shadow-sm">
          {/* SINC Button with Glowing LED */}
          <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-300 shadow-sm mb-2">
            <div>
              <span className="font-bold text-xs text-slate-800">SINCRONIZAÇÃO</span>
              <p className="text-[9px] text-slate-500">Pico da onda R (Cardioversão)</p>
            </div>
            <button
              onClick={handleToggleSync}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
                state.syncEnabled
                  ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${state.syncEnabled ? 'bg-white shadow animate-ping' : 'bg-slate-400'}`} />
              SINC
            </button>
          </div>

          {/* Rotary Dial Selector (1) */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                RODA SELETORA DE CARGA
              </span>
              <span className="text-xs font-black font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {state.knobPosition}
              </span>
            </div>

            {/* Quick energy selection buttons mimicking rotary positions */}
            <div className="grid grid-cols-4 gap-1 text-[11px] font-mono font-bold">
              <button
                onClick={() => handleKnobChange('DESLIGADO')}
                className={`py-1 rounded text-center transition ${state.knobPosition === 'DESLIGADO' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                DESL
              </button>
              <button
                onClick={() => handleKnobChange('MONITOR')}
                className={`py-1 rounded text-center transition ${state.knobPosition === 'MONITOR' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                MONIT
              </button>
              <button
                onClick={() => handleKnobChange('DEA')}
                className={`py-1 rounded text-center transition ${state.knobPosition === 'DEA' ? 'bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                DEA
              </button>
              <button
                onClick={() => handleKnobChange('50J')}
                className={`py-1 rounded text-center transition ${state.knobPosition === '50J' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                50J
              </button>
              <button
                onClick={() => handleKnobChange('70J')}
                className={`py-1 rounded text-center transition ${state.knobPosition === '70J' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                70J
              </button>
              <button
                onClick={() => handleKnobChange('100J')}
                className={`py-1 rounded text-center transition ${state.knobPosition === '100J' ? 'bg-blue-600 text-white shadow ring-2 ring-blue-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                title="Carga padrão para cardioversão sincronizada em taquicardias regulares"
              >
                100J
              </button>
              <button
                onClick={() => handleKnobChange('150J')}
                className={`py-1 rounded text-center transition ${state.knobPosition === '150J' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                150J
              </button>
              <button
                onClick={() => handleKnobChange('200J')}
                className={`py-1 rounded text-center transition ${state.knobPosition === '200J' ? 'bg-blue-700 text-white shadow ring-2 ring-blue-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                title="Carga padrão para desfibrilação bifásica de PCR (FV/TVSP)"
              >
                200J
              </button>
            </div>

            {/* Pacer options in rotary */}
            <div className="grid grid-cols-2 gap-1 mt-1 text-[11px] font-semibold">
              <button
                onClick={() => handleKnobChange('MARCAPASSO_DEMANDA')}
                className={`py-1 px-1 rounded text-center transition ${state.knobPosition === 'MARCAPASSO_DEMANDA' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                MP Demanda
              </button>
              <button
                onClick={() => handleKnobChange('MARCAPASSO_FIXO')}
                className={`py-1 px-1 rounded text-center transition ${state.knobPosition === 'MARCAPASSO_FIXO' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                MP Fixo
              </button>
            </div>
          </div>

          {/* Action Trigger Buttons: CARGA (2) and CHOQUE (3) */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {/* CARGA (2) */}
            <button
              onClick={handleCharge}
              disabled={isOff || state.isCharging || state.isCharged || !isEnergySelected}
              className={`py-3 px-2 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 shadow-md transition-all active:scale-95 ${
                state.isCharged
                  ? 'bg-blue-900 text-white opacity-80 cursor-not-allowed'
                  : state.isCharging
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : isEnergySelected && !isOff
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-white text-blue-700 text-[10px] flex items-center justify-center font-bold">
                  2
                </span>
                <span>CARGA</span>
              </div>
              <span className="text-[10px] font-normal">
                {state.isCharging ? 'Carregando...' : state.isCharged ? 'Carregado' : 'Carregar'}
              </span>
            </button>

            {/* CHOQUE (3) */}
            <button
              onClick={handleShock}
              disabled={!state.isCharged}
              className={`py-3 px-2 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 ${
                state.isCharged
                  ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-slate-950 ring-4 ring-orange-300 ring-offset-2 ring-offset-slate-900 animate-pulse cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-slate-950 text-white text-[10px] flex items-center justify-center font-bold">
                  3
                </span>
                <Zap className="w-3.5 h-3.5" />
                <span>CHOQUE</span>
              </div>
              <span className="text-[10px] font-normal">
                {state.isCharged ? 'DISPARAR AGORA' : 'Aguardando carga'}
              </span>
            </button>
          </div>

          {/* Safe Disarm Option */}
          {state.isCharged && (
            <button
              onClick={handleDisarm}
              className="mt-1.5 py-1 px-2 rounded bg-slate-300 hover:bg-slate-400 text-slate-700 text-[10px] font-bold flex items-center justify-center gap-1 transition"
            >
              <ShieldAlert className="w-3 h-3 text-red-500" /> Desarmar Carga Internamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
