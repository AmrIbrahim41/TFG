// src/utils/NutritionPDF_EN.jsx
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Svg, Path, Circle } from '@react-pdf/renderer';

const colors = {
    primary: '#f97316', secondary: '#27272a', accent: '#52525b', 
    light: '#f4f4f5', white: '#ffffff',
    protein: '#ef4444', carbs: '#3b82f6', fats: '#eab308'
};

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#1f2937' },
    
    // Header (LTR)
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, paddingBottom: 20, borderBottom: '2px solid #f97316' },
    
    brandColumn: { width: '45%', alignItems: 'flex-start' }, 
    brandTitle: { fontSize: 28, fontWeight: 'black', textTransform: 'uppercase', color: colors.secondary },
    brandSubtitle: { fontSize: 10, color: colors.primary, fontWeight: 'bold', marginTop: 4 },
    
    metaColumn: { width: '45%', alignItems: 'flex-end' }, 
    metaLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 },
    metaValue: { fontSize: 10, color: colors.secondary, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },

    // Dashboard (LTR)
    dashboard: { flexDirection: 'row', gap: 20, marginBottom: 30, height: 160 },
    statsCard: { flex: 1, backgroundColor: colors.light, borderRadius: 12, padding: 15, justifyContent: 'space-between' },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, // Reduced margin slightly
    
    // Tables (LTR)
    tableContainer: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.secondary, marginBottom: 15, flexDirection: 'row', alignItems: 'center' },
    tableHeader: { flexDirection: 'row', backgroundColor: colors.secondary, padding: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
    tableRow: { flexDirection: 'row', padding: 10, borderBottom: '1px solid #e5e7eb', alignItems: 'center' },
    
    colName: { flex: 3, textAlign: 'left' },
    colQty: { flex: 1, textAlign: 'right' },
    colMeta: { flex: 1, textAlign: 'right', fontSize: 8, color: '#9ca3af' },
    itemName: { fontSize: 10, fontWeight: 'bold', color: '#374151' },
    
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1px solid #f3f4f6', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }
});

const MacroPlate = ({ macros }) => (
    <Svg width="120" height="120" viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="48" fill="#e4e4e7" opacity="0.5" />
        <Circle cx="50" cy="50" r="46" fill="#ffffff" />
        <Path d="M50,50 L50,5 A45,45 0 0,1 93,75 Z" fill={colors.protein} opacity="0.9" />
        <Path d="M50,50 L6,75 A45,45 0 0,1 50,5 Z" fill={colors.carbs} opacity="0.9" />
        <Path d="M50,50 L93,75 A45,45 0 0,1 6,75 Z" fill={colors.fats} opacity="0.9" />
        <Circle cx="50" cy="50" r="45" fill="none" stroke="#f4f4f5" strokeWidth="2" />
    </Svg>
);

const NutritionPDF_EN = ({ plan, clientName, trainerName, brandText, results, exchangeList, notes }) => {
    const datePrinted = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Use raw data
    const targetCalories = results?.targetCalories || 0;
    const proteinGrams = results?.macros?.protein?.grams || 0;
    const carbsGrams = results?.macros?.carbs?.grams || 0;
    const fatsGrams = results?.macros?.fats?.grams || 0;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.brandColumn}>
                        <Text style={styles.brandTitle}>{brandText || "TFG"}</Text>
                        <Text style={styles.brandSubtitle}>Strategic Nutrition Plan</Text>
                    </View>
                    <View style={styles.metaColumn}>
                        <Text style={styles.metaLabel}>Client</Text>
                        <Text style={styles.metaValue}>{clientName || "N/A"}</Text>
                        <Text style={styles.metaLabel}>Trainer</Text>
                        <Text style={styles.metaValue}>{trainerName || "Coach"}</Text>
                        <Text style={styles.metaLabel}>Date</Text>
                        <Text style={styles.metaValue}>{datePrinted}</Text>
                    </View>
                </View>

                {/* Dashboard */}
                <View style={styles.dashboard}>
                    <View style={styles.statsCard}>
                        <View style={{borderBottom: '1px solid #e4e4e7', paddingBottom: 10, marginBottom: 8, alignItems: 'flex-start'}}>
                            <Text style={{ fontSize: 9, color: colors.accent }}>Daily Target</Text>
                            <Text style={{ fontSize: 16, fontWeight: 'black', color: colors.primary }}>
                                {targetCalories} <Text style={{fontSize:10}}>kcal</Text>
                            </Text>
                        </View>

                        {/* Activity */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:9}}>Activity Level</Text>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_activity_level || '-'}</Text>
                        </View>
                        
                        {/* Meals (Separate Row) */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:9}}>Main Meals</Text>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_meals || 0}</Text>
                        </View>

                        {/* Snacks (Separate Row) */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:9}}>Snacks</Text>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_snacks || 0}</Text>
                        </View>

                        {/* Weight */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:9}}>Weight</Text>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_weight || 0} kg</Text>
                        </View>
                        
                        {/* Water */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:9}}>Water Goal</Text>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>3.5 - 4.5 L</Text>
                        </View>
                    </View>

                    <View style={[styles.statsCard, { flex: 1.5, flexDirection: 'row', alignItems: 'center' }]}>
                        <View style={{ width: 160, alignItems: 'center' }}>
                            {results?.macros ? <MacroPlate macros={results.macros} /> : null}
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 10 }}>
                             <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10 }}>Macro Split</Text>
                             
                             <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
                                <View style={{width:8, height:8, borderRadius:4, backgroundColor:colors.protein, marginRight:6}}/>
                                <Text style={{ fontSize: 10, color: colors.secondary }}>Protein: {proteinGrams}g</Text>
                             </View>
                             <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
                                <View style={{width:8, height:8, borderRadius:4, backgroundColor:colors.carbs, marginRight:6}}/>
                                <Text style={{ fontSize: 10, color: colors.secondary }}>Carbs: {carbsGrams}g</Text>
                             </View>
                             <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
                                <View style={{width:8, height:8, borderRadius:4, backgroundColor:colors.fats, marginRight:6}}/>
                                <Text style={{ fontSize: 10, color: colors.secondary }}>Fats: {fatsGrams}g</Text>
                             </View>
                        </View>
                    </View>
                </View>

                {/* Tables */}
                {exchangeList && Object.entries(exchangeList).map(([groupName, data]) => {
                    const groupColor = groupName.includes('Protein') ? colors.protein : groupName.includes('Carb') ? colors.carbs : colors.fats;

                    return (
                        <View key={groupName} style={styles.tableContainer} wrap={false}>
                            <View style={styles.sectionTitle}>
                                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: groupColor, marginRight: 8 }} />
                                <Text>{groupName}</Text>
                                <Text style={{ fontSize: 9, color: colors.accent, textTransform: 'none', marginLeft: 'auto' }}>
                                    Target: <Text style={{fontWeight: 'bold', color: colors.secondary}}>{Math.round(data?.targetCals || 0)} kcal</Text> per meal
                                </Text>
                            </View>

                            <View style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                <View style={[styles.tableHeader, { backgroundColor: groupColor }]}>
                                    <Text style={[styles.colName, {color:'white', fontWeight:'bold', fontSize:9}]}>Item</Text>
                                    <Text style={[styles.colQty, {color:'white', fontWeight:'bold', fontSize:9}]}>Amount</Text>
                                    <Text style={[styles.colMeta, {color:'white', fontWeight:'bold', fontSize:9}]}>Cals</Text>
                                </View>

                                {data?.items?.length > 0 ? (
                                    data.items.map((item, idx) => (
                                        <View key={idx} style={styles.tableRow}>
                                            <View style={styles.colName}>
                                                <Text style={styles.itemName}>{item.name}</Text>
                                            </View>
                                            <Text style={[styles.colQty, { fontSize: 10, fontWeight: 'bold' }]}>{item.weight} {item.unit}</Text>
                                            <Text style={styles.colMeta}>~{item.meta?.cals || 0}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.tableRow}>
                                        <Text style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic', padding: 10 }}>No items selected.</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}

                {notes && (
                    <View style={{ marginTop: 10 }} wrap={false}>
                        <View style={styles.sectionTitle}><Text>Trainer Notes & Shopping List</Text></View>
                        <View style={{ padding: 20, backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, color: '#9a3412', lineHeight: 1.5 }}>{notes}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={{ fontSize: 8, color: '#d1d5db' }}>Generated by {brandText || "TFG"}</Text>
                    <Text style={{ fontSize: 8, color: '#d1d5db' }}>Page 1</Text>
                </View>

            </Page>
        </Document>
    );
};

export default NutritionPDF_EN;