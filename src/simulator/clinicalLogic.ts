/**
 * Clinical emergency simulation logic & validation
 * Grounded in ACLS/SBC 2020-2025 guidelines and UNISA OSCE slides
 */

export interface PatientVitals {
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  spO2: number;
  respiratoryRate: number;
  etCO2: number;
  consciousness: 'alert' | 'somnolent' | 'confused' | 'unresponsive';
  hasPulse: boolean;
  chestPain: boolean;
  dyspnea: boolean;
  shockSigns: boolean; // capillary refill > 2s, pale/sweaty
}

export type RhythmType =
  | 'sinus_normal'
  | 'sinus_brady'
  | 'bav_1'
  | 'bav_2_mobitz_1'
  | 'bav_2_mobitz_2'
  | 'bav_3_bavt'
  | 'paced'
  | 'tsv'
  | 'fa_alta_resposta'
  | 'flutter_atrial'
  | 'tv_monomorfica'
  | 'tv_polimorfica'
  | 'fv_grosseira'
  | 'fv_fina'
  | 'aesp'
  | 'assistolia';

/**
 * Checks if patient is hemodynamically unstable
 * 5 Criteria from slides:
 * 1. PAS < 90 mmHg (hipotensão)
 * 2. Rebaixamento do nível de consciência (RNC)
 * 3. Sinais de choque (hipoperfusão)
 * 4. Dor torácica anginosa
 * 5. Dispneia / congestão pulmonar
 */
export function checkInstability(vitals: PatientVitals): {
  isInstable: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (vitals.systolicBP < 90) {
    reasons.push('Hipotensão arterial (PAS < 90 mmHg)');
  }
  if (vitals.consciousness === 'unresponsive' || vitals.consciousness === 'confused' || vitals.consciousness === 'somnolent') {
    reasons.push('Rebaixamento ou alteração do nível de consciência');
  }
  if (vitals.shockSigns) {
    reasons.push('Sinais de choque e má perfusão periférica');
  }
  if (vitals.chestPain) {
    reasons.push('Dor torácica de padrão isquêmico');
  }
  if (vitals.dyspnea) {
    reasons.push('Dispneia / sinais de insuficiência respiratória');
  }

  return {
    isInstable: reasons.length > 0,
    reasons,
  };
}

/**
 * Checks if a rhythm is a cardiac arrest rhythm (PCR)
 */
export function isCardiacArrest(rhythm: RhythmType, hasPulse: boolean): boolean {
  if (!hasPulse) return true;
  return rhythm === 'fv_grosseira' || rhythm === 'fv_fina' || rhythm === 'assistolia';
}

/**
 * Checks if a rhythm is shockable in PCR
 */
export function isShockablePCR(rhythm: RhythmType, hasPulse: boolean): boolean {
  if (hasPulse) return false;
  return rhythm === 'fv_grosseira' || rhythm === 'fv_fina' || rhythm === 'tv_monomorfica' || rhythm === 'tv_polimorfica';
}

/**
 * Validates cardioversion requirements (Protocolo OSASCO)
 * - O: Orientar
 * - S: Sedar / analgesia
 * - A: Ambusar / pré-oxigenar
 * - S: Selecionar carga e Sincronizar (SINC ON)
 * - C: Cardioverter
 * - O: Observar ritmo e palpar pulso
 */
export function validateCardioversion(params: {
  rhythm: RhythmType;
  hasPulse: boolean;
  selectedEnergy: number;
  syncEnabled: boolean;
  isSedated: boolean;
  isOxygenated: boolean;
}): {
  success: boolean;
  message: string;
  inducedFV?: boolean;
} {
  // Cannot cardiovert a cardiac arrest (defibrillation is needed, no sync!)
  if (!params.hasPulse) {
    if (params.syncEnabled) {
      return {
        success: false,
        message: 'ERRO: Paciente em Parada Cardiorrespiratória (sem pulso)! O choque de DESFIBRILAÇÃO deve ser NÃO SINCRONIZADO.',
      };
    }
    if (params.selectedEnergy < 150) {
      return {
        success: false,
        message: `ATENÇÃO: Carga de desfibrilação muito baixa (${params.selectedEnergy}J). Recomendado 200J bifásico para PCR chocável.`,
      };
    }
    return {
      success: true,
      message: 'Desfibrilação de 200J realizada com sucesso! Reinicie a RCP imediatamente por 2 minutos.',
    };
  }

  // Patient has pulse -> This is Cardioversion (CVE)
  if (!params.syncEnabled) {
    return {
      success: false,
      message: 'PERIGO: Choque administrado SEM sincronização em paciente com pulso! Risco de fenômeno R-sobre-T e indução de Fibrilação Ventricular (FV)!',
      inducedFV: true,
    };
  }

  if (!params.isSedated) {
    return {
      success: false,
      message: 'FALHA DE PROTOCOLO (OSASCO): Paciente consciente não foi sedado antes do choque!',
    };
  }

  if (params.selectedEnergy < 50) {
    return {
      success: false,
      message: `Carga selecionada (${params.selectedEnergy}J) insuficiente para cardioversão da arritmia. Recomendado 100J a 200J.`,
    };
  }

  return {
    success: true,
    message: `Cardioversão Elétrica Sincronizada com ${params.selectedEnergy}J realizada no pico da onda R! Cheque imediatamente o ritmo e palpe o pulso carotídeo.`,
  };
}

/**
 * Validates transcutaneous pacing (Marca-passo transcutâneo TEC-5600)
 */
export function validatePacerCapture(params: {
  pacerActive: boolean;
  ratePPM: number;
  currentMA: number;
  thresholdMA: number;
}): {
  hasElectricalCapture: boolean;
  hasMechanicalCapture: boolean;
  message: string;
} {
  if (!params.pacerActive) {
    return {
      hasElectricalCapture: false,
      hasMechanicalCapture: false,
      message: 'Marca-passo desligado.',
    };
  }

  if (params.ratePPM < 50 || params.ratePPM > 100) {
    return {
      hasElectricalCapture: false,
      hasMechanicalCapture: false,
      message: 'Ajuste a frequência de estimulação entre 60 e 80 ppm.',
    };
  }

  if (params.currentMA < params.thresholdMA) {
    return {
      hasElectricalCapture: false,
      hasMechanicalCapture: false,
      message: `Estimulando a ${params.currentMA} mA: Espículas visíveis sem condução do QRS (Abaixo do limiar de captura de ~${params.thresholdMA} mA). Suba a corrente!`,
    };
  }

  return {
    hasElectricalCapture: true,
    hasMechanicalCapture: true,
    message: `Captura alcançada com sucesso a ${params.currentMA} mA (${params.ratePPM} ppm)! Espícula seguida de QRS largo. Pulso periférico palpável correspondente.`,
  };
}

/**
 * Atropine validation in bradycardias
 * Note from slides: "Não funciona em bloqueio atrioventricular total (BAVT) ou BAV de alto grau infranodal"
 */
export function validateAtropine(rhythm: RhythmType, currentDosesCount: number): {
  isIndicated: boolean;
  isEffective: boolean;
  message: string;
} {
  if (currentDosesCount >= 3) {
    return {
      isIndicated: false,
      isEffective: false,
      message: 'Dose máxima de Atropina atingida (3 mg no total: 1 mg a cada 3-5 min). Inicie droga vasoativa (Epinefrina/Dopamina) ou marca-passo transcutâneo!',
    };
  }

  if (rhythm === 'bav_3_bavt' || rhythm === 'bav_2_mobitz_2') {
    return {
      isIndicated: false,
      isEffective: false,
      message: 'ATENÇÃO: A Atropina atua no nó sinusal e AV proximal, SENDO INEFICAZ em BAV de 2º grau Mobitz II e BAVT (bloqueio infranodal). A conduta indicada é Marca-passo transcutâneo ou droga vasoativa!',
    };
  }

  return {
    isIndicated: true,
    isEffective: true,
    message: 'Atropina 1 mg EV administrada em bolus. Aguarde elevação da frequência cardíaca.',
  };
}
