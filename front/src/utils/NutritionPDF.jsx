import React, { forwardRef } from 'react';
import html2pdf from 'html2pdf.js';
import toast from 'react-hot-toast';

/**
 * Trigger the PDF download
 */
export const downloadNutritionPDF = (elementRef, filename) => {
    if (!elementRef) {
        toast.error("PDF Template not found");
        return;
    }

    const opt = {
        margin: 0, // Zero margin to allow full-width headers
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    toast.promise(
        html2pdf().from(elementRef).set(opt).save(),
        {
            loading: 'Generating Professional PDF...',
            success: 'PDF Downloaded!',
            error: 'Failed to generate PDF',
        }
    );
};

/**
 * The Hidden PDF Template - Modern & Eye-Catching
 */
export const NutritionPDFTemplate = forwardRef(({ plan, clientName, calcParams }, ref) => {
    
    // --- 1. PREPARE DATA ---
    // Create list of meals and snacks
    const mealSlots = Array.from({ length: calcParams.meals || 0 }).map((_, i) => ({ 
        type: 'meal', index: i + 1, label: `Meal ${i + 1}`, color: '#000000'
    }));
    
    const snackSlots = Array.from({ length: calcParams.snacks || 0 }).map((_, i) => ({ 
        type: 'snack', index: i + 1, label: `Snack ${i + 1}`, color: '#ea580c' // Orange for snacks
    }));

    const allSlots = [...mealSlots, ...snackSlots];

    // Helper to get items
    const getItemsForSlot = (type, index) => {
        if (plan.items) {
             return plan.items.filter(item => item.slotType === type && item.slotIndex === index);
        }
        return [];
    };

    return (
        <div className="absolute left-[-9999px] top-0">
            <div ref={ref} style={{ 
                width: '210mm', 
                minHeight: '297mm', 
                backgroundColor: '#ffffff', 
                color: '#1a1a1a', 
                fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                position: 'relative',
                paddingBottom: '50px'
            }}>
                
                {/* ================= HEADER SECTION ================= */}
                {/* 1. Brand Bar (Black) */}
                <div style={{ 
                    backgroundColor: '#000000', 
                    color: '#ffffff', 
                    padding: '30px 40px',
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h1 style={{ 
                            fontSize: '56px', 
                            fontWeight: '900', 
                            margin: 0, 
                            lineHeight: '0.8', 
                            letterSpacing: '-2px' 
                        }}>
                            TFG
                        </h1>
                        <div style={{ 
                            fontSize: '14px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '4px', 
                            color: '#ea580c', // Orange Accent
                            fontWeight: '700',
                            marginTop: '5px'
                        }}>
                            The Fitness Gym
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                            fontSize: '28px', 
                            fontWeight: '800', 
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>
                            Nutrition Plan
                        </div>
                        <div style={{ 
                            fontSize: '14px', 
                            opacity: 0.8,
                            marginTop: '4px' 
                        }}>
                            {plan?.name}
                        </div>
                    </div>
                </div>

                {/* 2. Info Bar (Orange Gradient) */}
                <div style={{ 
                    background: 'linear-gradient(90deg, #ea580c 0%, #f97316 100%)', 
                    padding: '15px 40px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600'
                }}>
                    {/* Client Info */}
                    <div style={{ display: 'flex', gap: '40px' }}>
                        <div>
                            <span style={{ opacity: 0.8, textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Client Name</span>
                            <span style={{ fontSize: '16px' }}>{clientName || 'Valued Client'}</span>
                        </div>
                        <div>
                            <span style={{ opacity: 0.8, textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Coach</span>
                            <span style={{ fontSize: '16px' }}>{plan?.created_by_name || 'Head Coach'}</span>
                        </div>
                        <div>
                            <span style={{ opacity: 0.8, textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Duration</span>
                            <span style={{ fontSize: '16px' }}>{plan?.duration_weeks || 4} Weeks</span>
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <span style={{ opacity: 0.8, textTransform: 'uppercase', fontSize: '10px', display: 'block', textAlign: 'right' }}>Date Generated</span>
                        <span style={{ fontSize: '16px' }}>{new Date().toLocaleDateString()}</span>
                    </div>
                </div>


                {/* ================= CONTENT SECTION ================= */}
                <div style={{ padding: '40px' }}>
                    
                    {/* The Menu Table */}
                    <div style={{ 
                        border: '2px solid #000', 
                        borderRadius: '12px', 
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                {allSlots.map((slot, i) => {
                                    const items = getItemsForSlot(slot.type, slot.index);
                                    const isLast = i === allSlots.length - 1;

                                    return (
                                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                            
                                            {/* Column 1: Meal Title */}
                                            <td style={{ 
                                                width: '25%',
                                                padding: '25px', 
                                                verticalAlign: 'middle',
                                                borderRight: '1px solid #e5e5e5',
                                                borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                                                backgroundColor: '#ffffff'
                                            }}>
                                                <div style={{ 
                                                    color: slot.color, 
                                                    fontWeight: '900', 
                                                    fontSize: '24px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '-1px'
                                                }}>
                                                    {slot.type === 'snack' ? `Snack ${slot.index}` : `Meal ${slot.index}`}
                                                </div>
                                                <div style={{ 
                                                    fontSize: '12px', 
                                                    color: '#888', 
                                                    fontWeight: '600',
                                                    marginTop: '4px',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {slot.type === 'snack' ? 'Flexible Option' : 'Main Course'}
                                                </div>
                                            </td>

                                            {/* Column 2: Items List */}
                                            <td style={{ 
                                                padding: '20px 30px', 
                                                verticalAlign: 'middle',
                                                borderBottom: isLast ? 'none' : '1px solid #e5e5e5'
                                            }}>
                                                {items && items.length > 0 ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                        {items.map((item, idx) => (
                                                            <div key={idx} style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                backgroundColor: '#fff', 
                                                                border: '1px solid #eee', 
                                                                padding: '8px 12px', 
                                                                borderRadius: '8px',
                                                                boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                                                            }}>
                                                                <div style={{ 
                                                                    width: '6px', 
                                                                    height: '6px', 
                                                                    backgroundColor: '#f97316', 
                                                                    borderRadius: '50%', 
                                                                    marginRight: '10px' 
                                                                }}></div>
                                                                <div>
                                                                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{item.name}</div>
                                                                    <div style={{ fontSize: '12px', color: '#666' }}>{item.amount}g</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ 
                                                        color: '#ccc', 
                                                        fontStyle: 'italic', 
                                                        fontSize: '14px',
                                                        textAlign: 'center',
                                                        padding: '10px',
                                                        border: '1px dashed #e5e5e5',
                                                        borderRadius: '8px'
                                                    }}>
                                                        No items selected for this meal
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ================= FOOTER SECTION ================= */}
                <div style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    width: '100%', 
                    backgroundColor: '#18181b', 
                    color: '#666', 
                    padding: '20px 40px', 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    <div>
                        Train Hard • Eat Smart • Live Better
                    </div>
                    <div>
                        © {new Date().getFullYear()} TFG System
                    </div>
                </div>

            </div>
        </div>
    );
});