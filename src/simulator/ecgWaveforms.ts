import type { RhythmType } from './clinicalLogic';

export interface WavePoint {
  val: number;          // -1 to 1 normalized ECG amplitude
  isRPeak?: boolean;    // Flag for sync detection on R wave apex
  isPacerSpike?: boolean;
}

/**
 * Calculates continuous ECG signal value at elapsed time `t` (seconds)
 */
export function getEcgSignal(
  t: number,
  rhythm: RhythmType,
  hr: number,
  pacerCapture: boolean = false,
  cagadaGain: number = 1.0
): WavePoint {
  // Safe clamped rate
  const rate = Math.max(20, Math.min(260, hr));
  const period = 60 / rate;
  const cycleTime = t % period;
  const cycleFraction = cycleTime / period;

  // Tiny biological baseline noise
  const noise = (Math.sin(t * 70) * 0.015 + Math.cos(t * 110) * 0.01) * cagadaGain;

  // 1. Assistolia
  if (rhythm === 'assistolia' || (rate === 0 && rhythm !== 'fv_grosseira' && rhythm !== 'fv_fina')) {
    return { val: (Math.sin(t * 12) * 0.02 + (Math.random() - 0.5) * 0.01) * cagadaGain };
  }

  // 2. Fibrilação Ventricular Grosseira
  if (rhythm === 'fv_grosseira') {
    const v1 = Math.sin(t * 28 + Math.sin(t * 9));
    const v2 = Math.sin(t * 19 + Math.cos(t * 13));
    const v3 = Math.sin(t * 41);
    const amp = 0.55 * cagadaGain;
    return { val: (v1 * 0.5 + v2 * 0.35 + v3 * 0.15) * amp };
  }

  // 3. Fibrilação Ventricular Fina
  if (rhythm === 'fv_fina') {
    const v1 = Math.sin(t * 35 + Math.sin(t * 12));
    const v2 = Math.cos(t * 23);
    const amp = 0.22 * cagadaGain;
    return { val: (v1 * 0.6 + v2 * 0.4) * amp };
  }

  // 4. TV Monomórfica
  if (rhythm === 'tv_monomorfica') {
    // Wide repetitive sine-triangular ventricular complexes
    const wave = -Math.sin(cycleFraction * Math.PI * 2);
    const notch = Math.sin(cycleFraction * Math.PI * 4) * 0.2;
    const isApex = cycleFraction > 0.22 && cycleFraction < 0.28;
    return {
      val: (wave + notch) * 0.8 * cagadaGain,
      isRPeak: isApex,
    };
  }

  // 5. TV Polimórfica (Torsades de Pointes)
  if (rhythm === 'tv_polimorfica') {
    const spindle = Math.sin(t * 0.8) * 0.5 + 0.5; // spindle envelope
    const rawWave = Math.sin(t * 32 + Math.cos(t * 6));
    const isApex = cycleFraction > 0.2 && cycleFraction < 0.3;
    return {
      val: rawWave * spindle * 0.9 * cagadaGain,
      isRPeak: isApex,
    };
  }

  // 6. Flutter Atrial
  if (rhythm === 'flutter_atrial') {
    // Continuous sawtooth baseline at ~300 bpm + QRS every 2nd or 3rd wave
    const fWave = (((t * 5) % 1) - 0.5) * 0.35;
    let qrs = 0;
    let isApex = false;
    if (cycleFraction > 0.18 && cycleFraction < 0.26) {
      const qrsFrac = (cycleFraction - 0.18) / 0.08;
      qrs = Math.sin(qrsFrac * Math.PI) * 0.9;
      if (qrsFrac > 0.4 && qrsFrac < 0.6) isApex = true;
    }
    return {
      val: (fWave + qrs) * cagadaGain,
      isRPeak: isApex,
    };
  }

  // 7. Fibrilação Atrial de Alta Resposta
  if (rhythm === 'fa_alta_resposta') {
    // Irregular rhythm: fluctuate cycle time slightly based on beat index
    const fibrillatoryBaseline = (Math.sin(t * 45) * 0.08 + Math.cos(t * 68) * 0.06);
    let qrs = 0;
    let isApex = false;
    if (cycleFraction > 0.2 && cycleFraction < 0.28) {
      const qrsFrac = (cycleFraction - 0.2) / 0.08;
      qrs = Math.sin(qrsFrac * Math.PI) * 0.95;
      if (qrsFrac > 0.4 && qrsFrac < 0.6) isApex = true;
    }
    return {
      val: (fibrillatoryBaseline + qrs) * cagadaGain,
      isRPeak: isApex,
    };
  }

  // 8. Paced Rhythm (Marca-passo com captura)
  if (pacerCapture || rhythm === 'paced') {
    let val = noise;
    let isSpike = false;
    let isApex = false;

    // Sharp pacer spike at cycleFraction ~0.15
    if (cycleFraction > 0.14 && cycleFraction < 0.16) {
      val = -0.9;
      isSpike = true;
    } else if (cycleFraction >= 0.16 && cycleFraction < 0.35) {
      // Wide ventricular QRS after spike
      const qrsFrac = (cycleFraction - 0.16) / 0.19;
      val = Math.sin(qrsFrac * Math.PI) * 0.85;
      if (qrsFrac > 0.4 && qrsFrac < 0.6) isApex = true;
    } else if (cycleFraction >= 0.38 && cycleFraction < 0.58) {
      // Inverted discordant T wave
      const tFrac = (cycleFraction - 0.38) / 0.2;
      val = -Math.sin(tFrac * Math.PI) * 0.3;
    }
    return {
      val: val * cagadaGain,
      isRPeak: isApex,
      isPacerSpike: isSpike,
    };
  }

  // 9. BAV de 3º Grau (BAVT) - P waves independent of wide slow QRS
  if (rhythm === 'bav_3_bavt') {
    // P waves at ~80 bpm
    const pPeriod = 60 / 80;
    const pFrac = (t % pPeriod) / pPeriod;
    let pWave = 0;
    if (pFrac > 0.1 && pFrac < 0.24) {
      pWave = Math.sin(((pFrac - 0.1) / 0.14) * Math.PI) * 0.25;
    }

    // Wide escape QRS at ~32 bpm (driven by cycleFraction)
    let qrsWave = 0;
    let isApex = false;
    if (cycleFraction > 0.35 && cycleFraction < 0.52) {
      const qrsFrac = (cycleFraction - 0.35) / 0.17;
      qrsWave = Math.sin(qrsFrac * Math.PI) * 0.8;
      if (qrsFrac > 0.45 && qrsFrac < 0.55) isApex = true;
    } else if (cycleFraction >= 0.54 && cycleFraction < 0.72) {
      const tFrac = (cycleFraction - 0.54) / 0.18;
      qrsWave = -Math.sin(tFrac * Math.PI) * 0.25;
    }

    return {
      val: (pWave + qrsWave + noise) * cagadaGain,
      isRPeak: isApex,
    };
  }

  // 10. BAV 1º Grau (Aumento fixo do intervalo PR > 0.20s)
  if (rhythm === 'bav_1') {
    let val = noise;
    let isApex = false;
    // P wave early at 0.05 - 0.15
    if (cycleFraction > 0.05 && cycleFraction < 0.16) {
      val += Math.sin(((cycleFraction - 0.05) / 0.11) * Math.PI) * 0.18;
    }
    // Long PR segment flat 0.16 - 0.38
    // QRS at 0.38 - 0.46
    if (cycleFraction >= 0.38 && cycleFraction < 0.46) {
      const qFrac = (cycleFraction - 0.38) / 0.08;
      val += Math.sin(qFrac * Math.PI) * 0.95;
      if (qFrac > 0.4 && qFrac < 0.6) isApex = true;
    }
    // T wave at 0.54 - 0.72
    if (cycleFraction >= 0.54 && cycleFraction < 0.72) {
      val += Math.sin(((cycleFraction - 0.54) / 0.18) * Math.PI) * 0.3;
    }
    return { val: val * cagadaGain, isRPeak: isApex };
  }

  // 11. Taquicardia Supraventricular (TSV - estreito, regular, P oculta)
  if (rhythm === 'tsv') {
    let val = noise;
    let isApex = false;
    // Sharp narrow QRS
    if (cycleFraction > 0.2 && cycleFraction < 0.35) {
      const qFrac = (cycleFraction - 0.2) / 0.15;
      val += Math.sin(qFrac * Math.PI) * 0.95;
      if (qFrac > 0.4 && qFrac < 0.6) isApex = true;
    }
    // ST-T wave blending directly into next beat
    if (cycleFraction >= 0.4 && cycleFraction < 0.8) {
      val += Math.sin(((cycleFraction - 0.4) / 0.4) * Math.PI) * 0.28;
    }
    return { val: val * cagadaGain, isRPeak: isApex };
  }

  // 12. Standard Sinus / Sinus Brady / AESP (Organized P-QRS-T)
  let val = noise;
  let isApex = false;

  // P wave (0.12 - 0.22)
  if (cycleFraction > 0.12 && cycleFraction < 0.22) {
    val += Math.sin(((cycleFraction - 0.12) / 0.1) * Math.PI) * 0.18;
  }
  // QRS complex (0.28 - 0.36)
  else if (cycleFraction >= 0.28 && cycleFraction < 0.36) {
    const qFrac = (cycleFraction - 0.28) / 0.08;
    if (qFrac < 0.2) {
      val -= 0.15 * (qFrac / 0.2); // Q dip
    } else if (qFrac < 0.6) {
      val += 1.0; // R peak
      isApex = true;
    } else {
      val -= 0.25; // S dip
    }
  }
  // T wave (0.46 - 0.64)
  else if (cycleFraction >= 0.46 && cycleFraction < 0.64) {
    val += Math.sin(((cycleFraction - 0.46) / 0.18) * Math.PI) * 0.32;
  }

  return { val: val * cagadaGain, isRPeak: isApex };
}

/**
 * Calculates continuous Plethysmography (SpO2) wave at time `t`
 */
export function getPlethSignal(t: number, hr: number, hasPulse: boolean): number {
  if (!hasPulse || hr <= 0) return 0;
  const rate = Math.max(30, Math.min(220, hr));
  const period = 60 / rate;
  const frac = (t % period) / period;

  if (frac < 0.3) {
    // Rapid systolic upstroke
    return Math.sin((frac / 0.3) * (Math.PI / 2));
  } else if (frac < 0.45) {
    // Dicrotic notch drop
    return 1 - (frac - 0.3) * 1.5;
  } else if (frac < 0.55) {
    // Dicrotic wave rebound
    return 0.77 + Math.sin(((frac - 0.45) / 0.1) * Math.PI) * 0.1;
  } else {
    // Diastolic runoff
    return 0.77 * Math.exp(-(frac - 0.55) * 4);
  }
}

/**
 * Calculates continuous Capnography (etCO2) square wave at time `t`
 */
export function getCapnoSignal(t: number, respRate: number, targetEtCO2: number): number {
  if (respRate <= 0 || targetEtCO2 <= 0) return 0;
  const period = 60 / respRate;
  const frac = (t % period) / period;

  // Normal respiration: ~40% expiration, ~60% inspiration
  if (frac < 0.1) {
    // Phase I: inspiratory baseline (0 mmHg)
    return 0;
  } else if (frac < 0.18) {
    // Phase II: rapid expiratory upstroke
    return ((frac - 0.1) / 0.08) * targetEtCO2 * 0.85;
  } else if (frac < 0.45) {
    // Phase III: alveolar plateau gently sloping up to etCO2 peak
    const plateauFrac = (frac - 0.18) / 0.27;
    return targetEtCO2 * 0.85 + plateauFrac * (targetEtCO2 * 0.15);
  } else if (frac < 0.52) {
    // Phase IV: rapid inspiratory downstroke back to baseline
    const downFrac = (frac - 0.45) / 0.07;
    return targetEtCO2 * (1 - downFrac);
  } else {
    // Inspiratory pause
    return 0;
  }
}
