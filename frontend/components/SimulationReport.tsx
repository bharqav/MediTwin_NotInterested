'use client';

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { SimulationResult, PatientProfile, DrugInput } from '@/types/simulation';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a2e' },
  header: { marginBottom: 20, borderBottom: '2 solid #00A3CC', paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#00A3CC', fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 11, color: '#5A637A', marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: '#0a0e1a', fontFamily: 'Helvetica-Bold' },
  summaryBox: { backgroundColor: '#f0f8ff', padding: 12, borderRadius: 4, marginBottom: 10, border: '1 solid #d0e8f2' },
  text: { fontSize: 10, lineHeight: 1.6, color: '#333' },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, fontSize: 10, color: '#5A637A', fontFamily: 'Helvetica-Bold' },
  value: { flex: 1, fontSize: 10 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  riskNumber: { fontSize: 28, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' },
  riskLabel: { fontSize: 10, color: '#5A637A', marginLeft: 8 },
  table: { marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e8f4f8', padding: 6, borderBottom: '1 solid #ccc' },
  tableRow: { flexDirection: 'row', padding: 6, borderBottom: '0.5 solid #eee' },
  tableCell: { flex: 1, fontSize: 9 },
  tableCellSmall: { width: 60, fontSize: 9, textAlign: 'center' },
  alertBox: { backgroundColor: '#fff3e0', padding: 8, borderRadius: 4, marginBottom: 6, border: '1 solid #ffe0b2' },
  alertBoxRed: { backgroundColor: '#fce4ec', padding: 8, borderRadius: 4, marginBottom: 6, border: '1 solid #f8bbd0' },
  notesBox: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 4, border: '1 solid #c8e6c9' },
  disclaimer: { fontSize: 7, color: '#999', marginTop: 20, paddingTop: 8, borderTop: '0.5 solid #ddd', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, fontSize: 7, color: '#999', textAlign: 'center' },
});

function riskColor(score: number): string {
  if (score <= 30) return '#1D9E75';
  if (score <= 60) return '#EF9F27';
  return '#E24B4A';
}

function riskLabel(score: number): string {
  if (score <= 30) return 'Low Risk';
  if (score <= 60) return 'Moderate Risk';
  return 'High Risk';
}

interface ReportProps {
  simulation: SimulationResult;
  profile: PatientProfile;
  drug: DrugInput;
}

function ReportDocument({ simulation, profile, drug }: ReportProps) {
  const sim = simulation;
  const now = new Date().toLocaleString();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>MediTwin Simulation Report</Text>
          <Text style={styles.subtitle}>
            {drug.name} {drug.dose_mg}mg {drug.route} — {profile.age}y {profile.sex} — Generated {now}
          </Text>
        </View>

        <View style={styles.summaryBox}>
          <Text style={[styles.text, { fontFamily: 'Helvetica-Bold', marginBottom: 4 }]}>Executive Summary</Text>
          <Text style={styles.text}>{sim.summary}</Text>
        </View>

        <View style={styles.sectionTitle}><Text>Risk Assessment</Text></View>
        <View style={styles.riskBadge}>
          <Text style={[styles.riskNumber, { color: riskColor(sim.risk_score) }]}>{sim.risk_score}</Text>
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.riskLabel, { color: riskColor(sim.risk_score), fontFamily: 'Helvetica-Bold', fontSize: 11 }]}>
              {riskLabel(sim.risk_score)}
            </Text>
            <Text style={styles.riskLabel}>Simulated Risk Estimate (0-100)</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>Risk Component</Text>
            <Text style={[styles.tableCellSmall, { fontFamily: 'Helvetica-Bold' }]}>Score</Text>
            <Text style={[styles.tableCellSmall, { fontFamily: 'Helvetica-Bold' }]}>Max</Text>
          </View>
          {[
            { label: 'Side Effect Risk', val: sim.risk_breakdown.side_effect_risk, max: 60 },
            { label: 'Interaction Risk', val: sim.risk_breakdown.interaction_risk, max: 25 },
            { label: 'Contraindication Risk', val: sim.risk_breakdown.contraindication_risk, max: 15 },
          ].map((r, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tableCell}>{r.label}</Text>
              <Text style={styles.tableCellSmall}>{r.val}</Text>
              <Text style={styles.tableCellSmall}>{r.max}</Text>
            </View>
          ))}
        </View>
        {sim.risk_score_explanation && (
          <Text style={[styles.text, { marginTop: 6, fontStyle: 'italic' }]}>{sim.risk_score_explanation}</Text>
        )}

        <View style={styles.sectionTitle}><Text>Predicted Side Effects</Text></View>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Effect</Text>
            <Text style={[styles.tableCellSmall, { fontFamily: 'Helvetica-Bold' }]}>Prob.</Text>
            <Text style={[styles.tableCellSmall, { fontFamily: 'Helvetica-Bold' }]}>Severity</Text>
            <Text style={[styles.tableCell, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>Explanation</Text>
          </View>
          {sim.predicted_side_effects.map((se, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{se.effect}</Text>
              <Text style={styles.tableCellSmall}>{(se.probability * 100).toFixed(0)}%</Text>
              <Text style={styles.tableCellSmall}>{se.severity}</Text>
              <Text style={[styles.tableCell, { flex: 3, fontSize: 8 }]}>{se.explanation}</Text>
            </View>
          ))}
        </View>

        {sim.interaction_flags.length > 0 && (
          <>
            <View style={styles.sectionTitle}><Text>Drug Interactions</Text></View>
            {sim.interaction_flags.map((f, i) => (
              <View key={i} style={styles.alertBox}>
                <Text style={[styles.text, { fontFamily: 'Helvetica-Bold' }]}>
                  {f.drug_a} + {f.drug_b} ({f.severity})
                </Text>
                <Text style={[styles.text, { fontSize: 9 }]}>{f.clinical_effect || f.mechanism}</Text>
                {f.recommendation && <Text style={[styles.text, { fontSize: 9, color: '#1565c0' }]}>Recommendation: {f.recommendation}</Text>}
              </View>
            ))}
          </>
        )}

        {sim.contraindication_alerts.length > 0 && (
          <>
            <View style={styles.sectionTitle}><Text>Contraindication Alerts</Text></View>
            {sim.contraindication_alerts.map((c, i) => (
              <View key={i} style={c.type === 'absolute' ? styles.alertBoxRed : styles.alertBox}>
                <Text style={[styles.text, { fontFamily: 'Helvetica-Bold' }]}>
                  [{c.type.toUpperCase()}] {c.condition.replace(/_/g, ' ')}
                </Text>
                <Text style={[styles.text, { fontSize: 9 }]}>{c.reason}</Text>
                {c.recommendation && <Text style={[styles.text, { fontSize: 9, color: '#1565c0' }]}>Recommendation: {c.recommendation}</Text>}
              </View>
            ))}
          </>
        )}

        {sim.patient_specific_notes && (
          <>
            <View style={styles.sectionTitle}><Text>Patient-Specific Notes</Text></View>
            <View style={styles.notesBox}>
              <Text style={styles.text}>{sim.patient_specific_notes}</Text>
            </View>
          </>
        )}

        <Text style={styles.disclaimer}>
          DISCLAIMER: MediTwin is an educational simulation tool only. The ML pipeline uses parametric pharmacological formulas and the LLM provides contextual reasoning — neither constitutes clinical validation. Do not make any medication or prescribing decisions based on MediTwin output. Always consult a licensed healthcare professional. For investigational research purposes only. All probability values shown are estimated.
        </Text>

        <Text style={styles.footer}>MediTwin v3.0 — Human Digital Twin for Medicine Safety Simulation</Text>
      </Page>
    </Document>
  );
}

export async function generatePDF(
  simulation: SimulationResult,
  profile: PatientProfile,
  drug: DrugInput
): Promise<void> {
  const blob = await pdf(
    <ReportDocument simulation={simulation} profile={profile} drug={drug} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meditwin-simulation-${drug.name.toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
