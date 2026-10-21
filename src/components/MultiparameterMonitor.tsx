import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import type { PatientVitals, RhythmType } from '../simulator/types';
import { getEcgSignal, getPlethSignal, getCapnoSignal } from '../simulator/ecgWaveforms';
import { soundEngine } from '../simulator/audio';

interface Props {
  vitals: PatientVitals;
  rhythm: RhythmType;
  syncEnabled: boolean;
  pacerCapture: boolean;
  isNIBPMeasuring: boolean;
  onTriggerNIBP: () => void;
  cagadaLead: 'DII' | 'DI' | 'DIII';
  onChangeLead: (lead: 'DII' | 'DI' | 'DIII') => void;
  cagadaGain: number;
  onChangeGain: (gain: number) => void;
  soundMuted: boolean;
  onToggleSound: () => void;
}

export const MultiparameterMonitor: React.FC<Props> = ({
  vitals,
  rhythm,
  syncEnabled,
  pacerCapture,
  isNIBPMeasuring,
  onTriggerNIBP,
  cagadaLead,
  onChangeLead,
  cagadaGain,
  onChangeGain,
  soundMuted,
  onToggleSound,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const sweepXRef = useRef<number>(0);
  const lastBeatTimeRef = useRef<number>(0);
  const [alarmSilenced, setAlarmSilenced] = useState(false);

  // Determine top alarm message based on UNISA slides
  let alarmBanner = '';
  let alarmColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';

  if (!vitals.hasPulse && vitals.heartRate === 0) {
    alarmBanner = '*** ASSISTOLIA / PARADA CARDÍACA';
    alarmColor = 'bg-red-950/80 text-red-400 border-red-600 animate-pulse';
  } else if (!vitals.hasPulse) {
    alarmBanner = '*** PARADA CARDIORRESPIRATÓRIA (SEM PULSO)';
    alarmColor = 'bg-red-950/80 text-red-400 border-red-600 animate-pulse';
  } else if (vitals.heartRate > 150) {
    alarmBanner = '*** TAQUICARDIA EXTREMA';
    alarmColor = 'bg-red-900/60 text-red-300 border-red-500';
  } else if (vitals.heartRate < 50) {
    alarmBanner = '*** BRADICARDIA (pulso)';
    alarmColor = 'bg-yellow-900/60 text-yellow-300 border-yellow-500';
  } else if (vitals.spO2 < 90) {
    alarmBanner = '*** DESATURAÇÃO GRAVE';
    alarmColor = 'bg-red-900/60 text-red-300 border-red-500';
  }

  // Animation Loop for real-time oscilloscope sweep
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 700);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 420);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      sweepXRef.current = 0;
      // Pre-fill background
      ctx.fillStyle = '#060a0f';
      ctx.fillRect(0, 0, width, height);
    };

    window.addEventListener('resize', handleResize);
    ctx.fillStyle = '#060a0f';
    ctx.fillRect(0, 0, width, height);

    const speed = 140; // pixels per second sweep speed

    const render = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const prevX = sweepXRef.current;
      sweepXRef.current += speed * dt;
      if (sweepXRef.current >= width) {
        sweepXRef.current = 0;
      }
      const curX = sweepXRef.current;

      // Clear cursor wipe band ahead of the sweep beam (12px wipe)
      ctx.fillStyle = '#060a0f';
      const wipeWidth = 22;
      ctx.fillRect(curX, 0, wipeWidth, height);
      if (curX + wipeWidth > width) {
        ctx.fillRect(0, 0, (curX + wipeWidth) % width, height);
      }

      // Draw subtle background medical grid lines on the cleared area
      ctx.strokeStyle = '#0d1820';
      ctx.lineWidth = 0.5;
      const gridSize = 25;
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(curX, y);
        ctx.lineTo(Math.min(curX + wipeWidth, width), y);
        ctx.stroke();
      }

      const tSec = now / 1000;

      // 1. ECG CHANNEL (Top half of canvas: y: 25 to 210)
      const ecgBaseline = height * 0.28;
      const ecgScale = 65 * cagadaGain;

      // Sample previous and current points for smooth antialiased line
      const ptCurrent = getEcgSignal(tSec, rhythm, vitals.heartRate, pacerCapture, cagadaGain);
      const ptPrev = getEcgSignal(tSec - dt, rhythm, vitals.heartRate, pacerCapture, cagadaGain);

      const yPrevEcg = ecgBaseline - ptPrev.val * ecgScale;
      const yCurEcg = ecgBaseline - ptCurrent.val * ecgScale;

      ctx.save();
      // Phosphor glow for ECG
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#10b981';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(prevX, yPrevEcg);
      ctx.lineTo(curX, yCurEcg);
      ctx.stroke();
      ctx.restore();

      // Sound trigger on R-wave peak
      if (ptCurrent.isRPeak && now - lastBeatTimeRef.current > 250) {
        lastBeatTimeRef.current = now;
        soundEngine.playHeartBeep(vitals.spO2);
      }

      // SYNC MARKER (Triangles on R-peak when SINC is enabled on TEC-5600)
      if (syncEnabled && ptCurrent.isRPeak) {
        ctx.save();
        ctx.fillStyle = '#f97316'; // Nihon Kohden orange sync marker
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(curX, yCurEcg - 14);
        ctx.lineTo(curX - 5, yCurEcg - 22);
        ctx.lineTo(curX + 5, yCurEcg - 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px Chakra Petch, monospace';
        ctx.fillStyle = '#fdba74';
        ctx.fillText('S', curX - 3, yCurEcg - 25);
        ctx.restore();
      }

      // PACER SPIKE (sharp needle marker)
      if (ptCurrent.isPacerSpike) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(curX, ecgBaseline - 60);
        ctx.lineTo(curX, ecgBaseline + 60);
        ctx.stroke();
        ctx.restore();
      }

      // 2. PLETHYSMOGRAPHY / SpO2 CHANNEL (Middle third: y: 220 to 310)
      const plethBaseline = height * 0.62;
      const plethScale = 36;
      const valPlethCur = getPlethSignal(tSec, vitals.heartRate, vitals.hasPulse);
      const valPlethPrev = getPlethSignal(tSec - dt, vitals.heartRate, vitals.hasPulse);

      const yCurPleth = plethBaseline - valPlethCur * plethScale;
      const yPrevPleth = plethBaseline - valPlethPrev * plethScale;

      ctx.save();
      ctx.shadowBlur = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(prevX, yPrevPleth);
      ctx.lineTo(curX, yCurPleth);
      ctx.stroke();
      ctx.restore();

      // 3. CAPNOGRAPHY / etCO2 CHANNEL (Bottom section: y: 320 to 400)
      const capnoBaseline = height * 0.90;
      const capnoScale = 1.1; // scale according to mmHg
      const valCapnoCur = getCapnoSignal(tSec, vitals.respiratoryRate, vitals.etCO2);
      const valCapnoPrev = getCapnoSignal(tSec - dt, vitals.respiratoryRate, vitals.etCO2);

      const yCurCapno = capnoBaseline - valCapnoCur * capnoScale;
      const yPrevCapno = capnoBaseline - valCapnoPrev * capnoScale;

      ctx.save();
      ctx.shadowBlur = 2;
      ctx.shadowColor = '#eab308';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(prevX, yPrevCapno);
      ctx.lineTo(curX, yCurCapno);
      ctx.stroke();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [rhythm, vitals.heartRate, vitals.spO2, vitals.respiratoryRate, vitals.etCO2, vitals.hasPulse, syncEnabled, pacerCapture, cagadaGain]);

  const pam = Math.round((vitals.systolicBP + 2 * vitals.diastolicBP) / 3);

  return (
    <div className="relative bg-[#070c12] border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans select-none">
      {/* Top Header Bar */}
      <div className="bg-[#0b131e] border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wider text-emerald-400">UNISA-HOSPITAL</span>
          <span className="text-slate-500">|</span>
          <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-200">
            Adulto • Leito 01
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Alarm Banner */}
        {alarmBanner && (
          <div className={`px-2.5 py-0.5 rounded font-bold text-xs border uppercase tracking-wide flex items-center gap-1.5 ${alarmColor}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{alarmBanner}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAlarmSilenced(!alarmSilenced)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              alarmSilenced ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {alarmSilenced ? 'Alarme Pausado' : 'Silenciar'}
          </button>
          <button
            onClick={onToggleSound}
            className={`p-1 rounded transition-colors ${
              soundMuted ? 'bg-red-900/60 text-red-300' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
            }`}
            title={soundMuted ? 'Ativar Som do Monitor' : 'Mutar Som'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Screen Body: Oscilloscope (left) + Numerics Panel (right) */}
      <div className="grid grid-cols-1 md:grid-cols-4 min-h-[360px] bg-[#05080c]">
        {/* Oscilloscope Canvas Area (3 cols) */}
        <div className="md:col-span-3 relative h-72 md:h-auto min-h-[320px] bg-[#04070a] border-r border-slate-800/80">
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Overlay Channel Labels */}
          <div className="absolute top-2 left-3 flex items-center gap-3 text-xs font-mono">
            <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
              {cagadaLead}
            </span>
            <span className="text-emerald-500/80 text-[11px]">
              1mV = 10mm ({cagadaGain === 1.0 ? 'x1' : cagadaGain === 2.0 ? 'x2 (CAGADA)' : 'x0.5'})
            </span>
            {syncEnabled && (
              <span className="bg-orange-500 text-slate-950 px-1.5 py-0.5 rounded font-black text-[10px] animate-pulse">
                SINC ATIVO
              </span>
            )}
            {pacerCapture && (
              <span className="bg-sky-500 text-slate-950 px-1.5 py-0.5 rounded font-black text-[10px]">
                MARCAPASSO CAPTURANDO
              </span>
            )}
          </div>

          <div className="absolute top-[48%] left-3 text-xs font-mono text-sky-400 font-bold">
            Plet / SpO2
          </div>

          <div className="absolute top-[75%] left-3 text-xs font-mono text-yellow-400 font-bold flex items-center gap-1.5">
            <span>etCO2</span>
            {vitals.etCO2 <= 10 && (
              <span className="text-[10px] text-red-400 bg-red-950/70 px-1 rounded">
                (Qualidade RCP baixa &lt; 10 mmHg)
              </span>
            )}
          </div>
        </div>

        {/* Clinical Numerics Column (Right) */}
        <div className="md:col-span-1 p-2.5 flex flex-col justify-between gap-2 bg-[#090f17] text-slate-100 font-mono">
          {/* FC / Heart Rate */}
          <div className="bg-[#05090f] p-2 rounded-lg border border-emerald-900/50">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-sans">
              <span className="font-bold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> FC (bpm)
              </span>
              <span className="text-[10px] text-slate-400">50 - 120</span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className={`text-4xl md:text-5xl font-black tracking-tight ${vitals.heartRate === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                {vitals.hasPulse ? vitals.heartRate : vitals.heartRate > 0 ? `${vitals.heartRate}*` : '0'}
              </span>
              {!vitals.hasPulse && vitals.heartRate > 0 && (
                <span className="text-[10px] text-amber-400 font-sans bg-amber-950/60 px-1 rounded">
                  Sem Pulso
                </span>
              )}
            </div>
          </div>

          {/* SpO2 */}
          <div className="bg-[#05090f] p-2 rounded-lg border border-sky-900/50">
            <div className="flex items-center justify-between text-xs text-sky-400 font-sans">
              <span className="font-bold">SpO₂ (%)</span>
              <span className="text-[10px] text-slate-400">Pulso: {vitals.hasPulse ? vitals.heartRate : 0}</span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className={`text-3xl md:text-4xl font-black ${vitals.spO2 < 90 ? 'text-red-400 animate-pulse' : 'text-sky-300'}`}>
                {vitals.hasPulse ? vitals.spO2 : '--'}
              </span>
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>

          {/* PANI (Pressão Arterial Não Invasiva) */}
          <div className="bg-[#05090f] p-2 rounded-lg border border-rose-900/50">
            <div className="flex items-center justify-between text-xs text-rose-400 font-sans">
              <span className="font-bold">PANI (mmHg)</span>
              <button
                onClick={onTriggerNIBP}
                disabled={isNIBPMeasuring}
                className="text-[10px] bg-rose-950 hover:bg-rose-900 text-rose-300 px-1.5 py-0.5 rounded border border-rose-700/60 flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isNIBPMeasuring ? 'animate-spin' : ''}`} />
                {isNIBPMeasuring ? 'Medindo...' : 'Aferir'}
              </button>
            </div>
            <div className="mt-0.5">
              {isNIBPMeasuring ? (
                <span className="text-lg text-slate-400 animate-pulse">Insuflanto manguito...</span>
              ) : vitals.hasPulse ? (
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl md:text-3xl font-black ${vitals.systolicBP < 90 ? 'text-rose-400 font-black' : 'text-slate-100'}`}>
                    {vitals.systolicBP}/{vitals.diastolicBP}
                  </span>
                  <span className="text-xs text-slate-400">({pam})</span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-red-500">INAUDÍVEL</span>
              )}
            </div>
          </div>

          {/* awFR & etCO2 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#05090f] p-1.5 rounded-lg border border-slate-800">
              <div className="text-[11px] text-slate-400 font-sans font-bold">FR (rpm)</div>
              <div className="text-xl md:text-2xl font-black text-slate-200 mt-0.5">
                {vitals.respiratoryRate > 0 ? vitals.respiratoryRate : '0'}
              </div>
            </div>
            <div className="bg-[#05090f] p-1.5 rounded-lg border border-yellow-900/50">
              <div className="text-[11px] text-yellow-400 font-sans font-bold">etCO₂</div>
              <div className={`text-xl md:text-2xl font-black mt-0.5 ${vitals.etCO2 < 10 && vitals.hasPulse === false ? 'text-red-400' : 'text-yellow-300'}`}>
                {vitals.etCO2 > 0 ? `${vitals.etCO2}` : '-?-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monitor Bottom Toolbar (Softkeys matching slides) */}
      <div className="bg-[#080d14] border-t border-slate-800 p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-sans font-semibold text-[11px]">Derivação ECG:</span>
          {(['DII', 'DI', 'DIII'] as const).map((lead) => (
            <button
              key={lead}
              onClick={() => onChangeLead(lead)}
              className={`px-2 py-1 rounded text-xs font-mono font-bold transition ${
                cagadaLead === lead
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {lead}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-sans font-semibold text-[11px]">Ganho:</span>
          {([0.5, 1.0, 2.0] as const).map((gain) => (
            <button
              key={gain}
              onClick={() => onChangeGain(gain)}
              className={`px-2 py-1 rounded text-xs font-mono font-bold transition ${
                cagadaGain === gain
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              x{gain}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 font-sans">
          Curvas: DII (Verde) • SpO₂ (Azul) • Capnografia (Amarelo)
        </div>
      </div>
    </div>
  );
};
