// src/utils/NutritionPDF_AR.jsx
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Svg, Path, Circle, Font } from '@react-pdf/renderer';

// IMPORT LOCAL FONT
// تأكد أن ملف الخط موجود في نفس المجلد باسم Cairo-ExtraBold.ttf
import CairoFont from './Cairo-ExtraBold.ttf';

// FIX 1: Font Registration with Weights
Font.register({
  family: 'Cairo',
  src: CairoFont,
});

const colors = {
    primary: '#f97316', secondary: '#27272a', accent: '#52525b', 
    light: '#f4f4f5', white: '#ffffff',
    protein: '#ef4444', carbs: '#3b82f6', fats: '#eab308'
};

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Cairo', backgroundColor: '#ffffff', color: '#1f2937' },
    
    // Header
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 30, paddingBottom: 20, borderBottom: '2px solid #f97316' },
    
    brandColumn: { width: '45%', alignItems: 'flex-end' }, 
    brandTitle: { fontSize: 28, fontWeight: 'black', textTransform: 'uppercase', color: colors.secondary },
    brandSubtitle: { fontSize: 10, color: colors.primary, fontWeight: 'bold', marginTop: 4 },
    
    metaColumn: { width: '45%', alignItems: 'flex-end' }, 
    metaLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 2 },
    metaValue: { fontSize: 10, color: colors.secondary, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },

    // Dashboard
    dashboard: { flexDirection: 'row-reverse', gap: 20, marginBottom: 30, height: 160 },
    statsCard: { flex: 1, backgroundColor: colors.light, borderRadius: 12, padding: 15, justifyContent: 'space-between' },
    statRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, // قللنا المارجن قليلا عشان المساحة
    
    // Tables
    tableContainer: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.secondary, marginBottom: 15, flexDirection: 'row-reverse', alignItems: 'center' },
    
    // FIX 2: Layout Strategy for Tables
    tableHeader: { 
        flexDirection: 'row', 
        backgroundColor: colors.secondary, 
        padding: 8, 
        borderTopLeftRadius: 6, 
        borderTopRightRadius: 6 
    },
    tableRow: { 
        flexDirection: 'row', 
        padding: 10, 
        borderBottom: '1px solid #e5e7eb', 
        alignItems: 'center' 
    },
    
    colName: { flex: 3, textAlign: 'right' }, 
    colQty: { flex: 1, textAlign: 'left', paddingLeft: 10 }, 
    colMeta: { flex: 1, textAlign: 'left', fontSize: 8, color: '#9ca3af' }, 
    
    itemName: { fontSize: 10, color: '#374151', textAlign: 'right' },
    
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1px solid #f3f4f6', paddingTop: 10, flexDirection: 'row-reverse', justifyContent: 'space-between' }
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

const NutritionPDF_AR = ({ plan, clientName, trainerName, brandText, results, exchangeList, notes }) => {
    const datePrinted = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const targetCalories = results?.targetCalories || 0;
    const proteinGrams = results?.macros?.protein?.grams || 0;
    const carbsGrams = results?.macros?.carbs?.grams || 0;
    const fatsGrams = results?.macros?.fats?.grams || 0;

    const getArabicGroupName = (name) => {
        if (!name) return '';
        if (name.includes('Protein')) return 'مصادر البروتين';
        if (name.includes('Carb')) return 'مصادر الكربوهيدرات';
        if (name.includes('Fat')) return 'الدهون الصحية';
        return name;
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.brandColumn}>
                        <Text style={styles.brandTitle}>{brandText || "TFG"}</Text>
                        <Text style={styles.brandSubtitle}>خطة التغذية الاستراتيجية</Text>
                    </View>
                    <View style={styles.metaColumn}>
                        <Text style={styles.metaLabel}>العميل</Text>
                        <Text style={styles.metaValue}>{clientName || "غير محدد"}</Text>
                        <Text style={styles.metaLabel}>المدرب</Text>
                        <Text style={styles.metaValue}>{trainerName || "الكابتن"}</Text>
                        <Text style={styles.metaLabel}>التاريخ</Text>
                        <Text style={styles.metaValue}>{datePrinted}</Text>
                    </View>
                </View>

                {/* Dashboard */}
                <View style={styles.dashboard}>
                    <View style={styles.statsCard}>
                        {/* Target Calories */}
                        <View style={{borderBottom: '1px solid #e4e4e7', paddingBottom: 10, marginBottom: 8, alignItems: 'flex-end'}}>
                            <Text style={{ fontSize: 9, color: colors.accent }}>السعرات اليومية المستهدفة</Text>
                            <Text style={{ fontSize: 14, fontWeight: 'black', color: colors.primary }}>
                                {targetCalories} <Text style={{fontSize:10}}>كالوري</Text>
                            </Text>
                        </View>

                        {/* Activity Level */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_activity_level || '-'}</Text>
                            <Text style={{fontSize:9}}>مستوى النشاط</Text>
                        </View>
                        
                        {/* Meals Count (Separate Row) */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_meals || 0}</Text>
                            <Text style={{fontSize:9}}>عدد الوجبات الرئيسية</Text>
                        </View>

                        {/* Snacks Count (Separate Row) */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_snacks || 0}</Text>
                            <Text style={{fontSize:9}}>عدد السناكس</Text>
                        </View>

                        {/* Weight */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>{plan?.calc_weight || 0} كجم</Text>
                            <Text style={{fontSize:9}}>الوزن الحالي</Text>
                        </View>
                        
                        {/* Water Goal */}
                        <View style={styles.statRow}>
                            <Text style={{fontSize:11, fontWeight:'bold'}}>٣.٥ - ٤.٥ لتر</Text>
                            <Text style={{fontSize:9}}>هدف المياه</Text>
                        </View>
                    </View>

                    {/* Macro Plate */}
                    <View style={[styles.statsCard, { flex: 1.5, flexDirection: 'row-reverse', alignItems: 'center' }]}>
                        <View style={{ width: 160, alignItems: 'center' }}>
                            {results?.macros ? <MacroPlate macros={results.macros} /> : null}
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 10 }}>
                             <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10 }}>توزيع الماكروز</Text>
                             <View style={{flexDirection:'row-reverse', alignItems:'center', marginBottom:4}}>
                                <View style={{width:8, height:8, borderRadius:4, backgroundColor:colors.protein, marginLeft:6}}/>
                                <Text style={{ fontSize: 10, color: colors.secondary }}>بروتين: {proteinGrams} جم</Text>
                             </View>
                             <View style={{flexDirection:'row-reverse', alignItems:'center', marginBottom:4}}>
                                <View style={{width:8, height:8, borderRadius:4, backgroundColor:colors.carbs, marginLeft:6}}/>
                                <Text style={{ fontSize: 10, color: colors.secondary }}>كارب: {carbsGrams} جم</Text>
                             </View>
                             <View style={{flexDirection:'row-reverse', alignItems:'center', marginBottom:4}}>
                                <View style={{width:8, height:8, borderRadius:4, backgroundColor:colors.fats, marginLeft:6}}/>
                                <Text style={{ fontSize: 10, color: colors.secondary }}>دهون: {fatsGrams} جم</Text>
                             </View>
                        </View>
                    </View>
                </View>

                {/* Tables Section */}
                {exchangeList && Object.entries(exchangeList).map(([groupName, data]) => {
                    const groupColor = groupName.includes('Protein') ? colors.protein : groupName.includes('Carb') ? colors.carbs : colors.fats;
                    const arabicTitle = getArabicGroupName(groupName);

                    return (
                        <View key={groupName} style={styles.tableContainer} wrap={false}>
                            {/* Section Title */}
                            <View style={styles.sectionTitle}>
                                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: groupColor, marginLeft: 8 }} />
                                <Text>{arabicTitle}</Text>
                                <Text style={{ fontSize: 9, color: colors.accent, textTransform: 'none', marginRight: 10 }}>
                                    الهدف: <Text style={{fontWeight: 'bold', color: colors.secondary}}>{Math.round(data?.targetCals || 0)} سعرة</Text> لكل وجبة
                                </Text>
                            </View>

                            <View style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                {/* Table Header */}
                                <View style={[styles.tableHeader, { backgroundColor: groupColor }]}>
                                    <Text style={[styles.colMeta, {color:'white', fontWeight:'bold', fontSize:9}]}>سعرات</Text>
                                    <Text style={[styles.colQty, {color:'white', fontWeight:'bold', fontSize:9}]}>الكمية</Text>
                                    <Text style={[styles.colName, {color:'white', fontWeight:'bold', fontSize:9}]}>نوع الطعام</Text>
                                </View>

                                {data?.items?.length > 0 ? (
                                    data.items.map((item, idx) => (
                                        <View key={idx} style={styles.tableRow}>
                                            <Text style={styles.colMeta}>~{item.meta?.cals || 0}</Text>
                                            <Text style={[styles.colQty, { fontSize: 10, fontWeight: 'bold' }]}>
                                                {item.weight} {item.unit === 'g' ? 'جم' : item.unit}
                                            </Text>
                                            <View style={styles.colName}>
                                                <Text style={styles.itemName}>
                                                    {item.arabic_name ? item.arabic_name : item.name}
                                                </Text>
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <View style={[styles.tableRow, {justifyContent:'flex-end'}]}>
                                        <Text style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic', padding: 10, textAlign:'right' }}>
                                            لم يتم اختيار عناصر لهذه القائمة.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}

                {notes && (
                    <View style={{ marginTop: 10 }} wrap={false}>
                        <View style={styles.sectionTitle}><Text>ملاحظات المدرب</Text></View>
                        <View style={{ padding: 20, backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, color: '#9a3412', lineHeight: 1.5, textAlign: 'right' }}>{notes}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={{ fontSize: 8, color: '#d1d5db' }}>{brandText} تم الإنشاء بواسطة نظام</Text>
                    <Text style={{ fontSize: 8, color: '#d1d5db' }}>صفحة 1</Text>
                </View>

            </Page>
        </Document>
    );
};

export default NutritionPDF_AR;