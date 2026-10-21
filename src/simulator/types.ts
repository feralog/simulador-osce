import type { PatientVitals, RhythmType } from './clinicalLogic';

export type { PatientVitals, RhythmType };

export type SimulationMode = 'megacode' | 'focused' | 'random';

export interface MoveStatus {
  monitor: boolean;     // M: Monitorização cardíaca, SpO2, PANI
  oxygen: boolean;      // O: Oxigênio suplementar (máscara/cateter)
  venoclysis: boolean;  // V: Acesso venoso periférico calibroso
  exams: boolean;       // E: Exames laboratoriais e ECG de 12 derivações
}

export interface OsascoStatus {
  orientar: boolean;
  sedar: boolean;
  ambusar: boolean;
  sincronizar: boolean;
  cardioverter: boolean;
  observar: boolean;
}

export interface CagadaStatus {
  cabos: boolean;       // Checar cabos e conexões
  aumentarGanho: boolean; // Aumentar ganho do monitor
  derivacao: boolean;   // Trocar derivação (DII para DI ou DIII)
}

export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
}

export interface ClinicalQuestion {
  id: string;
  title: string;
  question: string;
  options: MultipleChoiceOption[];
  explanation: string;
}

export interface ScenarioPhase {
  id: string;
  phaseNumber: number;
  phaseName: string;
  narrative: string;
  vitals: PatientVitals;
  rhythm: RhythmType;
  pacerThresholdMA?: number;
  question: ClinicalQuestion;
  targetActionHint?: string;
  expectedOutcomeMessage?: string;
}

export interface ClinicalScenario {
  id: string;
  title: string;
  category: 'megacode' | 'bradi' | 'taqui' | 'pcr';
  description: string;
  briefing: {
    setting: string;
    patientDescription: string;
    initialComplaint: string;
    vitalSignsSummary: string;
  };
  phases: ScenarioPhase[];
}

export type DefibrillatorKnobPosition =
  | 'DESLIGADO'
  | 'MONITOR'
  | 'DEA'
  | '2J'
  | '5J'
  | '7J'
  | '10J'
  | '15J'
  | '20J'
  | '30J'
  | '50J'
  | '70J'
  | '100J'
  | '150J'
  | '200J'
  | '270J'
  | 'MARCAPASSO_FIXO'
  | 'MARCAPASSO_DEMANDA';

export interface Tec5600State {
  knobPosition: DefibrillatorKnobPosition;
  syncEnabled: boolean;
  isCharging: boolean;
  isCharged: boolean;
  chargedJoules: number;
  chargeProgress: number; // 0 - 100%
  paddlesConnected: boolean;
  leadSelected: 'PÁS' | 'DII' | 'DI' | 'DIII';
  // Pacer parameters
  pacerActive: boolean;
  pacerRatePPM: number;
  pacerCurrentMA: number;
}
