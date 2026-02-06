import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// --- Theme & Colors (High Contrast Dark Mode) ---
const theme = {
    bg: '#16161a',           
    card: '#262629',         
    border: '#27272A',       
    primary: '#F97316',      
    textMain: '#FFFFFF',     
    textMuted: '#A1A1AA',    
};

// --- Vibrant Colors for Techniques & Equipment ---
const badgeStyles = {
    'Super Set': { bg: 'rgba(192, 132, 252, 0.15)', text: '#E9D5FF', border: '#A855F7' },
    'Drop Set':  { bg: 'rgba(244, 63, 94, 0.15)',   text: '#FECDD3', border: '#F43F5E' },
    'Pyramid':   { bg: 'rgba(251, 191, 36, 0.15)',  text: '#FDE68A', border: '#F59E0B' },
    'Negative':  { bg: 'rgba(59, 130, 246, 0.15)',  text: '#BFDBFE', border: '#3B82F6' },
    'Regular':   { bg: '#27272A',                   text: '#D4D4D8', border: '#52525B' },
    'Dumbbell':   { bg: 'rgba(34, 211, 238, 0.15)', text: '#A5F3FC', border: '#06B6D4' },
    'Barbell':    { bg: 'rgba(148, 163, 184, 0.15)', text: '#CBD5E1', border: '#64748B' },
    'Machine':    { bg: 'rgba(167, 139, 250, 0.15)', text: '#DDD6FE', border: '#8B5CF6' },
    'Cable':      { bg: 'rgba(250, 204, 21, 0.15)',  text: '#FEF08A', border: '#EAB308' },
    'Bodyweight': { bg: 'rgba(52, 211, 153, 0.15)',  text: '#A7F3D0', border: '#10B981' },
    'Smith Machine': { bg: 'rgba(244, 114, 182, 0.15)', text: '#FBCFE8', border: '#EC4899' },
};

const styles = StyleSheet.create({
    page: { padding: 24, fontFamily: 'Helvetica', backgroundColor: theme.bg, color: theme.textMain },
    
    // --- HEADER ---
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    logoSection: { flexDirection: 'column', alignItems: 'flex-start' },
    logoRow: { flexDirection: 'row', alignItems: 'center' }, // New helper style
    logoBar: { width: 3, height: 30, backgroundColor: theme.primary, marginRight: 10 }, // Extracted style
    logoText: { fontSize: 36, fontWeight: 'bold', color: theme.primary, marginBottom: 0, lineHeight: 1 },
    logoSubText: { fontSize: 9, color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
    badgesColumn: { flexDirection: 'column', gap: 5, alignItems: 'flex-end' },
    infoBadge: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, flexDirection: 'row', minWidth: 130, justifyContent: 'space-between', alignItems: 'center' },
    badgeLabel: { fontSize: 7, color: theme.textMuted, textTransform: 'uppercase' },
    badgeValue: { fontSize: 8, color: theme.textMain, fontWeight: 'bold' },
    orangeDivider: { height: 2, backgroundColor: theme.primary, width: '100%', marginTop: 15, marginBottom: 20, opacity: 0.8 },

    // --- SESSION CARD ---
    sessionCard: { backgroundColor: theme.card, borderRadius: 12, height: 60, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginBottom: 24 },
    sessionBar: { width: 6, height: '100%', backgroundColor: theme.primary },
    sessionContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
    sessionTitle: { fontSize: 22, fontWeight: 'bold', color: theme.textMain },
    sessionMeta: { fontSize: 9, color: theme.textMuted },

    // --- EXERCISE CARD ---
    exerciseCard: { backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16, overflow: 'hidden' },
    exHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F22' },
    numberCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    numberText: { fontSize: 10, fontWeight: 'bold', color: '#000000' },
    exTitle: { fontSize: 13, fontWeight: 'bold', color: theme.textMain },

    // Table
    tableHeaderRow: { flexDirection: 'row', backgroundColor: '#09090B', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F22', alignItems: 'center' },
    
    // Columns
    colIndex: { width: '8%',  alignItems: 'flex-start' },
    colReps:  { width: '12%', alignItems: 'center' },
    colWeight:{ width: '15%', alignItems: 'center' }, // Cleaned up layout
    colWeightContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }, // Nested helper
    colTech:  { width: '30%', alignItems: 'center' },
    colEquip: { width: '35%', alignItems: 'center' },

    headerText: { fontSize: 7, color: theme.textMuted, fontWeight: 'bold', letterSpacing: 0.5 },
    cellText:   { fontSize: 10, color: theme.textMain, fontWeight: 'bold' },
    unitText:   { fontSize: 8, color: theme.textMuted, marginLeft: 2 },
    badgeContainer: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center', width: '90%' },
    badgeText: { fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase' },
});

// Fixed: Ensure it always returns a string to prevent PDF crashes
const safeText = (t) => {
    if (t === 0 || t === '0') return '0';
    if (!t) return '-';
    return String(t);
};

const getStyle = (text) => {
    if (!text) return badgeStyles['Regular'];
    const key = Object.keys(badgeStyles).find(k => String(text).toLowerCase().includes(k.toLowerCase()));
    return badgeStyles[key] || { bg: 'transparent', text: theme.textMuted, border: 'transparent' };
};

const getTechStyle = (text) => {
    if (!text) return badgeStyles['Regular'];
    const key = Object.keys(badgeStyles).find(k => String(text).toLowerCase().includes(k.toLowerCase()));
    return badgeStyles[key] || badgeStyles['Regular'];
};

const WorkoutPDF = ({ sessionNumber, clientName, trainerName, date, exercises = [], sessionName }) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                
                {/* --- HEADER --- */}
                <View style={styles.headerContainer}>
                    <View style={styles.logoSection}>
                        <View style={styles.logoRow}>
                            <View style={styles.logoBar} />
                            <Text style={styles.logoText}>TFG</Text>
                        </View>
                        <Text style={styles.logoSubText}>Personal Training Program</Text>
                    </View>

                    <View style={styles.badgesColumn}>
                        <View style={styles.infoBadge}>
                            <Text style={styles.badgeLabel}>DATE</Text>
                            <Text style={styles.badgeValue}>{safeText(date)}</Text>
                        </View>
                        <View style={styles.infoBadge}>
                            <Text style={styles.badgeLabel}>CLIENT</Text>
                            <Text style={styles.badgeValue}>{safeText(clientName)}</Text>
                        </View>
                        <View style={styles.infoBadge}>
                            <Text style={styles.badgeLabel}>TRAINER</Text>
                            <Text style={styles.badgeValue}>{safeText(trainerName)}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.orangeDivider} />

                {/* --- SESSION TITLE CARD --- */}
                <View style={styles.sessionCard}>
                    <View style={styles.sessionBar} />
                    <View style={styles.sessionContent}>
                        <Text style={styles.sessionTitle}>{sessionName || `Day ${sessionNumber}`}</Text>
                        <Text style={styles.sessionMeta}>
                            Session #{String(sessionNumber)}  •  {String(exercises.length)} Exercises
                        </Text>
                    </View>
                </View>

                {/* --- EXERCISES LIST --- */}
                {exercises.map((ex, idx) => (
                    <View key={idx} style={styles.exerciseCard} wrap={false}>
                        
                        <View style={styles.exHeader}>
                            <View style={styles.numberCircle}>
                                <Text style={styles.numberText}>{String(idx + 1)}</Text>
                            </View>
                            <Text style={styles.exTitle}>{safeText(ex.name)}</Text>
                        </View>

                        <View style={styles.tableHeaderRow}>
                            <View style={styles.colIndex}><Text style={styles.headerText}>SET</Text></View>
                            <View style={styles.colReps}><Text style={styles.headerText}>REPS</Text></View>
                            <View style={styles.colWeight}><Text style={styles.headerText}>WEIGHT</Text></View>
                            <View style={styles.colTech}><Text style={styles.headerText}>TECHNIQUE</Text></View>
                            <View style={styles.colEquip}><Text style={styles.headerText}>EQUIPMENT</Text></View>
                        </View>

                        {/* Sets Rows */}
                        {ex.sets && ex.sets.map((set, sIdx) => {
                            const techSt = getTechStyle(set.technique);
                            const equipSt = getStyle(set.equipment);
                            const hasEquipColor = equipSt.bg !== 'transparent';

                            return (
                                <View key={sIdx} style={styles.tableRow}>
                                    
                                    <View style={styles.colIndex}>
                                        <Text style={[styles.cellText, { color: theme.textMuted }]}>{String(sIdx + 1)}</Text>
                                    </View>

                                    <View style={styles.colReps}>
                                        <Text style={styles.cellText}>{safeText(set.reps)}</Text>
                                    </View>

                                    {/* Fix: Nested Text in One Line to avoid invalid string children in row view */}
                                    <View style={styles.colWeight}>
                                        <View style={styles.colWeightContent}>
                                            <Text style={styles.cellText}>{safeText(set.weight)}</Text>
                                            <Text style={styles.unitText}>kg</Text>
                                        </View>
                                    </View>

                                    <View style={styles.colTech}>
                                        <View style={[styles.badgeContainer, { backgroundColor: techSt.bg, borderColor: techSt.border }]}>
                                            <Text style={[styles.badgeText, { color: techSt.text }]}>{set.technique || 'Regular'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.colEquip}>
                                        {hasEquipColor ? (
                                            <View style={[styles.badgeContainer, { backgroundColor: equipSt.bg, borderColor: equipSt.border }]}>
                                                <Text style={[styles.badgeText, { color: equipSt.text }]}>{safeText(set.equipment)}</Text>
                                            </View>
                                        ) : (
                                            <Text style={[styles.cellText, { color: theme.textMuted, fontSize: 9 }]}>{safeText(set.equipment)}</Text>
                                        )}
                                    </View>

                                </View>
                            );
                        })}
                    </View>
                ))}

            </Page>
        </Document>
    );
};

export default WorkoutPDF;