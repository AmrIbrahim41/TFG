import React from 'react';
import { Page, Text, View, Document, StyleSheet, Svg, Path, Circle } from '@react-pdf/renderer';

// --- MODERN STYLING SYSTEM (YOUR DESIGN) ---
const colors = {
    primary: '#f97316',   // Orange
    secondary: '#27272a', // Zinc-800
    accent: '#52525b',    // Zinc-600
    light: '#f4f4f5',     // Zinc-100
    white: '#ffffff',
    
    // Macro Colors
    protein: '#ef4444',   // Red
    carbs: '#3b82f6',     // Blue
    fats: '#eab308'       // Yellow
};

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#1f2937' },
    
    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, paddingBottom: 20, borderBottom: '2px solid #f97316' },
    brandColumn: { flexDirection: 'column' },
    brandTitle: { fontSize: 28, fontWeight: 'black', textTransform: 'uppercase', color: colors.secondary, letterSpacing: 1 },
    brandSubtitle: { fontSize: 10, color: colors.primary, fontWeight: 'bold', marginTop: 4, letterSpacing: 2 },
    
    metaColumn: { alignItems: 'flex-end' },
    metaLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 },
    metaValue: { fontSize: 10, color: colors.secondary, fontWeight: 'bold', marginBottom: 8 },

    // Section Headers
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.secondary, marginBottom: 15, textTransform: 'uppercase', flexDirection: 'row', alignItems: 'center' },
    sectionLine: { height: 2, backgroundColor: colors.light, flex: 1, marginLeft: 10 },

    // Dashboard / Top Grid
    dashboard: { flexDirection: 'row', gap: 20, marginBottom: 30, height: 160 },
    
    // Stats Card (Left)
    statsCard: { flex: 1, backgroundColor: colors.light, borderRadius: 12, padding: 15, justifyContent: 'space-between' },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    statLabel: { fontSize: 9, color: colors.accent, fontWeight: 'medium' },
    statValue: { fontSize: 11, fontWeight: 'bold', color: colors.secondary },
    highlightValue: { fontSize: 16, fontWeight: 'black', color: colors.primary },

    // Plate Card (Center/Right)
    plateCard: { width: 160, alignItems: 'center', justifyContent: 'center' },
    
    // Legend
    legendContainer: { marginTop: 10, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    legendText: { fontSize: 8, color: colors.accent },

    // Food Tables
    tableContainer: { marginBottom: 20 },
    tableHeader: { flexDirection: 'row', backgroundColor: colors.secondary, padding: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
    tableHeaderCell: { fontSize: 9, color: colors.white, fontWeight: 'bold' },
    tableRow: { flexDirection: 'row', padding: 10, borderBottom: '1px solid #e5e7eb', alignItems: 'center' },
    tableRowAlt: { backgroundColor: '#fafafa' },
    
    colName: { flex: 3 },
    colQty: { flex: 1, textAlign: 'right' },
    colMeta: { flex: 1, textAlign: 'right', fontSize: 8, color: '#9ca3af' },

    itemName: { fontSize: 10, fontWeight: 'bold', color: '#374151' },
    itemSub: { fontSize: 8, color: '#9ca3af', marginTop: 1 },

    // Notes
    notesBox: { padding: 20, backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 8 },
    noteText: { fontSize: 10, color: '#9a3412', lineHeight: 1.5 },

    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1px solid #f3f4f6', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
    footerText: { fontSize: 8, color: '#d1d5db' }
});

// --- HELPER: MACRO PLATE SVG ---
const MacroPlate = ({ macros }) => {
    return (
        <Svg width="120" height="120" viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="48" fill="#e4e4e7" opacity="0.5" />
            <Circle cx="50" cy="50" r="46" fill="#ffffff" />
            
            {/* Protein (Top Right) */}
            <Path d="M50,50 L50,5 A45,45 0 0,1 93,75 Z" fill={colors.protein} opacity="0.9" />
            
            {/* Carbs (Top Left) */}
            <Path d="M50,50 L6,75 A45,45 0 0,1 50,5 Z" fill={colors.carbs} opacity="0.9" />
            
            {/* Fats (Bottom) */}
            <Path d="M50,50 L93,75 A45,45 0 0,1 6,75 Z" fill={colors.fats} opacity="0.9" />

            <Circle cx="50" cy="50" r="45" fill="none" stroke="#f4f4f5" strokeWidth="2" />
        </Svg>
    );
};

const NutritionDocument = ({ 
    plan, 
    clientName, 
    trainerName, 
    brandText, 
    carbAdjustment, 
    results, 
    exchangeList, 
    notes 
}) => {
    const datePrinted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // --- LOGIC: Point 8 (Carb Calculation) ---
    const baseCarbCals = results?.perMeal?.carbsCals || 0;
    const adjustmentFactor = 1 + (parseInt(carbAdjustment || 0) / 100);
    const adjustedCarbCals = Math.round(baseCarbCals * adjustmentFactor);
    const isAdjusted = parseInt(carbAdjustment) !== 0;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                
                {/* 1. BRAND HEADER (Point 11 & 9) */}
                <View style={styles.header}>
                    <View style={styles.brandColumn}>
                        <Text style={styles.brandTitle}>{brandText || "TFG"}</Text>
                        <Text style={styles.brandSubtitle}>NUTRITION STRATEGY</Text>
                    </View>
                    <View style={styles.metaColumn}>
                        <Text style={styles.metaLabel}>ATHLETE</Text>
                        <Text style={styles.metaValue}>{clientName}</Text>
                        
                        <Text style={styles.metaLabel}>COACH</Text>
                        <Text style={styles.metaValue}>{trainerName || "Coach"}</Text>

                        <Text style={styles.metaLabel}>DATE</Text>
                        <Text style={styles.metaValue}>{datePrinted}</Text>
                    </View>
                </View>

                {/* 2. DASHBOARD SUMMARY */}
                <View style={styles.dashboard}>
                    
                    {/* Left: Numbers */}
                    <View style={styles.statsCard}>
                        <View style={{borderBottom: '1px solid #e4e4e7', paddingBottom: 10, marginBottom: 10}}>
                            <Text style={[styles.statLabel, { fontSize: 10, color: colors.primary }]}>DAILY CALORIE TARGET</Text>
                            <Text style={styles.highlightValue}>{results.targetCalories} <Text style={{fontSize: 10, color: colors.accent}}>kcal</Text></Text>
                        </View>

                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Activity Level</Text>
                            <Text style={styles.statValue}>{plan.calc_activity_level?.replace('_', ' ').toUpperCase()}</Text>
                        </View>
                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Meals per Day</Text>
                            <Text style={styles.statValue}>{plan.calc_meals} Meals + {plan.calc_snacks} Snacks</Text>
                        </View>
                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Current Weight</Text>
                            <Text style={styles.statValue}>{plan.calc_weight} kg</Text>
                        </View>
                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Water Goal</Text>
                            <Text style={styles.statValue}>3.5 - 4.5 Liters</Text>
                        </View>
                    </View>

                    {/* Right: The Plate Visual */}
                    <View style={[styles.statsCard, { flex: 1.5, flexDirection: 'row', alignItems: 'center' }]}>
                        <View style={styles.plateCard}>
                             <MacroPlate macros={results.macros} />
                        </View>
                        <View style={{ flex: 1, paddingLeft: 10 }}>
                             <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10, color: colors.secondary }}>MACRO SPLIT</Text>
                             
                             {/* Protein Legend */}
                             <View style={{ marginBottom: 8 }}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: colors.protein }]} />
                                    <Text style={[styles.statLabel, { color: colors.protein, fontWeight: 'bold' }]}>PROTEIN</Text>
                                </View>
                                <Text style={styles.statValue}>{results.macros.protein.grams}g <Text style={{fontWeight: 'normal', color: '#9ca3af'}}>({results.macros.protein.pct}%)</Text></Text>
                             </View>

                             {/* Carbs Legend (Point 8 Visual) */}
                             <View style={{ marginBottom: 8 }}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: colors.carbs }]} />
                                    <Text style={[styles.statLabel, { color: colors.carbs, fontWeight: 'bold' }]}>CARBOHYDRATES</Text>
                                    {isAdjusted && <Text style={{fontSize:8, color: colors.carbs, marginLeft:4}}>({carbAdjustment > 0 ? '+' : ''}{carbAdjustment}%)</Text>}
                                </View>
                                <Text style={styles.statValue}>{results.macros.carbs.grams}g <Text style={{fontWeight: 'normal', color: '#9ca3af'}}>({results.macros.carbs.pct}%)</Text></Text>
                             </View>

                             {/* Fats Legend */}
                             <View style={{ marginBottom: 8 }}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: colors.fats }]} />
                                    <Text style={[styles.statLabel, { color: colors.fats, fontWeight: 'bold' }]}>HEALTHY FATS</Text>
                                </View>
                                <Text style={styles.statValue}>{results.macros.fats.grams}g <Text style={{fontWeight: 'normal', color: '#9ca3af'}}>({results.macros.fats.pct}%)</Text></Text>
                             </View>
                        </View>
                    </View>
                </View>

                {/* 3. EXCHANGE LIST TABLES */}
                {exchangeList && Object.entries(exchangeList).map(([groupName, data], index) => {
                    const groupColor = groupName.includes('Protein') ? colors.protein : groupName.includes('Carb') ? colors.carbs : colors.fats;
                    
                    // --- Point 8: Display Adjusted Target for Carbs ---
                    const isCarbGroup = groupName.includes('Carb') || groupName.includes('Carbohydrates');
                    const targetDisplay = (isCarbGroup && isAdjusted) ? adjustedCarbCals : Math.round(data.targetCals);

                    return (
                        <View key={groupName} style={styles.tableContainer} wrap={false}>
                            <View style={styles.sectionTitle}>
                                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: groupColor, marginRight: 8 }} />
                                <Text>{groupName}</Text>
                                <View style={styles.sectionLine} />
                                <Text style={{ fontSize: 9, color: colors.accent, textTransform: 'none', marginLeft: 10 }}>
                                    Target: <Text style={{fontWeight: 'bold', color: colors.secondary}}>{targetDisplay} kcal</Text> per meal
                                    {isCarbGroup && isAdjusted && (
                                        <Text style={{color: colors.carbs}}> ({carbAdjustment > 0 ? '+' : ''}{carbAdjustment}%)</Text>
                                    )}
                                </Text>
                            </View>

                            <View style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                {/* Table Head */}
                                <View style={[styles.tableHeader, { backgroundColor: groupColor }]}>
                                    <Text style={[styles.tableHeaderCell, styles.colName]}>FOOD SOURCE</Text>
                                    <Text style={[styles.tableHeaderCell, styles.colQty]}>PORTION</Text>
                                    <Text style={[styles.tableHeaderCell, styles.colMeta]}>EST. CALS</Text>
                                </View>

                                {/* Table Body */}
                                {data.items.length > 0 ? (
                                    data.items.map((item, idx) => (
                                        <View key={idx} style={[styles.tableRow, idx % 2 !== 0 ? styles.tableRowAlt : {}]}>
                                            <View style={styles.colName}>
                                                <Text style={styles.itemName}>{item.name}</Text>
                                            </View>
                                            <Text style={[styles.colQty, { fontSize: 10, fontWeight: 'bold' }]}>{item.weight}{item.unit}</Text>
                                            <Text style={styles.colMeta}>~{item.meta.cals}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.tableRow}>
                                        <Text style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic', padding: 10 }}>No items selected for this category.</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}

                {/* 4. NOTES SECTION */}
                {notes && (
                    <View style={{ marginTop: 10 }} wrap={false}>
                        <View style={styles.sectionTitle}>
                            <Text>COACH NOTES & GROCERY LIST</Text>
                            <View style={styles.sectionLine} />
                        </View>
                        <View style={styles.notesBox}>
                            <Text style={styles.noteText}>{notes}</Text>
                        </View>
                    </View>
                )}

                {/* FOOTER */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Generated by {brandText || "TFG"} System</Text>
                    <Text style={styles.footerText}>Page 1 of 1</Text>
                </View>

            </Page>
        </Document>
    );
};

export default NutritionDocument;