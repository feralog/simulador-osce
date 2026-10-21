import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkInstability,
  isShockablePCR,
  validateCardioversion,
  validatePacerCapture,
  validateAtropine,
  type PatientVitals,
} from './clinicalLogic';

test('detects hypotension and instability correctly', () => {
  const unstableVitals: PatientVitals = {
    heartRate: 180,
    systolicBP: 80,
    diastolicBP: 50,
    spO2: 91,
    respiratoryRate: 28,
    etCO2: 35,
    consciousness: 'confused',
    hasPulse: true,
    chestPain: true,
    dyspnea: true,
    shockSigns: true,
  };

  const evalResult = checkInstability(unstableVitals);
  assert.equal(evalResult.isInstable, true);
  assert.equal(evalResult.reasons.length >= 3, true);

  const stableVitals: PatientVitals = {
    heartRate: 155,
    systolicBP: 125,
    diastolicBP: 80,
    spO2: 98,
    respiratoryRate: 18,
    etCO2: 38,
    consciousness: 'alert',
    hasPulse: true,
    chestPain: false,
    dyspnea: false,
    shockSigns: false,
  };

  const stableEval = checkInstability(stableVitals);
  assert.equal(stableEval.isInstable, false);
  assert.equal(stableEval.reasons.length, 0);
});

test('PCR shockable rhythms are correctly classified', () => {
  assert.equal(isShockablePCR('fv_grosseira', false), true);
  assert.equal(isShockablePCR('tv_monomorfica', false), true);
  assert.equal(isShockablePCR('assistolia', false), false);
  assert.equal(isShockablePCR('aesp', false), false);
  // If pulse exists, it is not PCR shockable
  assert.equal(isShockablePCR('tv_monomorfica', true), false);
});

test('OSASCO cardioversion requires synchronization and sedation', () => {
  // Non-synchronized shock on patient with pulse triggers warning / R-on-T risk
  const unsynced = validateCardioversion({
    rhythm: 'tv_monomorfica',
    hasPulse: true,
    selectedEnergy: 100,
    syncEnabled: false,
    isSedated: true,
    isOxygenated: true,
  });
  assert.equal(unsynced.success, false);
  assert.equal(unsynced.inducedFV, true);

  // Unsedated
  const unsedated = validateCardioversion({
    rhythm: 'tsv',
    hasPulse: true,
    selectedEnergy: 100,
    syncEnabled: true,
    isSedated: false,
    isOxygenated: true,
  });
  assert.equal(unsedated.success, false);

  // Fully compliant OSASCO
  const compliant = validateCardioversion({
    rhythm: 'tsv',
    hasPulse: true,
    selectedEnergy: 100,
    syncEnabled: true,
    isSedated: true,
    isOxygenated: true,
  });
  assert.equal(compliant.success, true);
});

test('Pacemaker requires sufficient current (mA) for threshold capture', () => {
  const below = validatePacerCapture({
    pacerActive: true,
    ratePPM: 70,
    currentMA: 40,
    thresholdMA: 65,
  });
  assert.equal(below.hasElectricalCapture, false);

  const above = validatePacerCapture({
    pacerActive: true,
    ratePPM: 70,
    currentMA: 70,
    thresholdMA: 65,
  });
  assert.equal(above.hasElectricalCapture, true);
});

test('Atropine is flagged as ineffective for BAVT (3rd degree AV block)', () => {
  const bavtTest = validateAtropine('bav_3_bavt', 0);
  assert.equal(bavtTest.isEffective, false);

  const sinusTest = validateAtropine('sinus_brady', 0);
  assert.equal(sinusTest.isEffective, true);

  const maxDoseTest = validateAtropine('sinus_brady', 3);
  assert.equal(maxDoseTest.isIndicated, false);
});
