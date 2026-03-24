import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, Plus, X, ReceiptText, Sparkles, Link2, PlusCircle,
  EyeOff, Package, ShieldAlert, Truck,
} from 'lucide-react';
import {
  getSuppliers, createSupplier,
  getIngredients, getResaleProducts,
  createIngredient, createResaleProduct,
  createInvoice, updateInvoice,
  checkDuplicateInvoice, confirmInvoiceAtomic,
} from '../lib/firestore';
import { extractInvoiceFromFile } from '../lib/aiExtraction';
import { uploadInvoiceFile, validateInvoiceFile, getCloudinaryThumbnailUrl } from '../lib/invoiceStorage';
import { formatCurrency, normalizeUnit, ALLOWED_UNITS, applyUnitConversion } from '../lib/utils';

const ACCEPTED_TYPES = 'image/*,application/pdf';

const ITEM_TYPE_LABELS = {
  ingredient: 'Ingrediente',
  resale_product: 'Produto Revenda',
  ignore: 'Ignorar',
  unknown: 'Desconhecido',
};

const ITEM_TYPE_COLORS = {
  ingredient: 'bg-green-100 text-green-800',
  resale_product: 'bg-blue-100 text-blue-800',
  ignore: 'bg-gray-100 text-gray-500',
  unknown: 'bg-yellow-100 text-yellow-800',
};

const STATUS_LABELS = {
  draft: 'Rascunho',
  extracted: 'Extraído',
  in_review: 'Em revisão',
  imported: 'Importado',
  with_divergence: 'Com divergência',
  failed: 'Falha na importação',
  cancelled: 'Cancelado',
};

const PurchasesPage = () => {
  const { restaurant, user, currency } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload | review | done
  const [dragging, setDragging] = useState(false);

  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [resaleProducts, setResaleProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState(null);

  const [invoiceHeader, setInvoiceHeader] = useState({
    supplierNameDetected: '',
    invoiceNumber: '',
    invoiceDate: '',
    currency: 'BRL',
    totalAmount: '',
  });
  const [reviewLines, setReviewLines] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedResult, setSavedResult] = useState(null);

  useEffect(() => {
    if (!restaurant?.id) return;
    loadData();
  }, [restaurant?.id]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [s, i, r] = await Promise.all([
        getSuppliers(restaurant.id),
        getIngredients(restaurant.id),
        getResaleProducts(restaurant.id),
      ]);
      setSuppliers(s);
      setIngredients(i);
      setResaleProducts(r);
    } catch {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoadingData(false);
    }
  };

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    const error = validateInvoiceFile(file);
    if (error) {
      toast({ title: 'Arquivo inválido', description: error, variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setFilePreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setExtractionError(null);
  }, [toast]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setCreatingSupplier(true);
    try {
      const created = await createSupplier(restaurant.id, { name: newSupplierName.trim() });
      const fresh = await getSuppliers(restaurant.id);
      setSuppliers(fresh);
      const found = fresh.find(s => s.name === newSupplierName.trim()) || { ...created, name: newSupplierName.trim() };
      setSelectedSupplier(found);
      setNewSupplierName('');
      setShowNewSupplierForm(false);
      setShowSupplierDropdown(false);
      toast({ title: 'Fornecedor criado com sucesso' });
    } catch {
      toast({ title: 'Erro ao criar fornecedor', variant: 'destructive' });
    } finally {
      setCreatingSupplier(false);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    setIsExtracting(true);
    setExtractionError(null);
    try {
      const result = await extractInvoiceFromFile(selectedFile);
      if (!result) throw new Error('A IA não conseguiu extrair dados. Verifique se a imagem está nítida.');

      setInvoiceHeader({
        supplierNameDetected: result.supplier_name_detected || '',
        invoiceNumber: result.invoice_number || '',
        invoiceDate: result.invoice_date || '',
        currency: result.currency || (restaurant?.currency || 'BRL'),
        totalAmount: result.total_amount != null ? String(result.total_amount) : '',
      });

      setReviewLines((result.items || []).map((item, idx) => {
        // Normalize unit to official system units (g, ml, L, Kg, uni)
        // Apply unit conversion (AI may already have done this; this is the safety net)
        const aiNeedsConversion = item.needs_conversion === true;
        const conv = applyUnitConversion(item.quantity, item.unit);
        // Honour AI flag if it raised one even if client-side didn't catch it
        const needsConversion = aiNeedsConversion || conv.needsConversion;
        const conversionNote = item.conversion_note || conv.conversionNote || null;

        const convQty    = conv.quantity;
        const aiLineTotal = item.line_total != null ? parseFloat(item.line_total) : null;
        const aiUnitPrice = item.unit_price != null ? parseFloat(item.unit_price) : null;

        // Bug B fix: if quantity was multiplied by conversion (e.g. 15 dz → 180 uni),
        // the AI's unit_price is still "per original unit" (per dozen).
        // Recalculate as lineTotal / convertedQty so stock cost is correct.
        const quantityChanged = convQty != null && convQty !== parseFloat(item.quantity);
        let finalUnitPrice;
        if (quantityChanged && aiLineTotal > 0 && convQty > 0) {
          finalUnitPrice = String(Math.round(aiLineTotal / convQty * 10000) / 10000);
        } else {
          finalUnitPrice = aiUnitPrice != null ? String(aiUnitPrice) : '';
        }

        return {
          _id: idx,
          rawDescription: item.raw_description || '',
          suggestedName: item.suggested_name || item.raw_description || '',
          quantity: convQty != null ? String(convQty) : '',
          unit: conv.unit || null,
          unitPrice: finalUnitPrice,
          lineTotal: item.line_total != null ? String(item.line_total) : '',
          itemType: item.suggested_item_type || 'unknown',
          linkedItemId: null,
          createNew: false,
          needsConversion,
          conversionNote,
          // Preserve original values so user can see what was converted
          _origQuantity: item.quantity,
          _origUnit: item.unit,
          // Multiplier for user to fill in when needsConversion is true
          userMultiplier: '',
        };
      }));

      setStep('review');
    } catch (err) {
      setExtractionError(err.message || 'Erro na extração com IA. Tente novamente.');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateLine = (idx, field, value) => {
    setReviewLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };

      // Auto-calculate the third numeric field from the other two
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = parseFloat(field === 'quantity' ? value : updated.quantity);
        const up  = parseFloat(field === 'unitPrice'  ? value : updated.unitPrice);
        if (qty > 0 && up > 0) {
          updated.lineTotal = String(Math.round(qty * up * 100) / 100);
        }
      } else if (field === 'lineTotal') {
        const qty = parseFloat(updated.quantity);
        const lt  = parseFloat(value);
        if (qty > 0 && lt > 0) {
          updated.unitPrice = String(Math.round(lt / qty * 10000) / 10000);
        }
      }

      return updated;
    }));
  };

  const getItemOptions = (itemType) => {
    if (itemType === 'ingredient') return ingredients.map(i => ({ id: i.id, name: i.name, unit: i.unit }));
    if (itemType === 'resale_product') return resaleProducts.map(r => ({ id: r.id, name: r.name }));
    return [];
  };

  const activeLines = reviewLines.filter(l => l.itemType !== 'ignore');
  const stockLines = reviewLines.filter(l => l.itemType === 'ingredient' || l.itemType === 'resale_product');

  const handleImport = async () => {
    if (!selectedSupplier) {
      toast({ title: 'Selecione um fornecedor antes de importar.', variant: 'destructive' });
      return;
    }

    const unknownLines = reviewLines.filter(l => l.itemType === 'unknown');
    if (unknownLines.length > 0) {
      toast({
        title: `${unknownLines.length} item(ns) com tipo desconhecido`,
        description: 'Classifique todos os itens ou marque como "Ignorar" antes de importar.',
        variant: 'destructive',
      });
      return;
    }

    const unlinkedStockLines = stockLines.filter(l => !l.linkedItemId && !l.createNew);
    if (unlinkedStockLines.length > 0) {
      toast({
        title: `${unlinkedStockLines.length} item(ns) sem vínculo`,
        description: 'Vincule ou marque para criar cada item antes de importar.',
        variant: 'destructive',
      });
      return;
    }

    if (duplicateWarning) {
      toast({ title: 'Nota duplicada detectada. Verifique antes de confirmar.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    // Declared outside try so the catch block can mark the invoice as failed if it was created
    let invoiceId = null;
    try {
      const totalAmount = parseFloat(invoiceHeader.totalAmount) || 0;

      // Step 1: Create invoice header doc
      const created = await createInvoice(restaurant.id, {
        supplierId: selectedSupplier.id,
        supplierNameSnapshot: selectedSupplier.name,
        supplierNameDetected: invoiceHeader.supplierNameDetected,
        invoiceNumber: invoiceHeader.invoiceNumber,
        invoiceDate: invoiceHeader.invoiceDate,
        currency: invoiceHeader.currency,
        totalAmount,
        fileUrl: '',
        fileType: selectedFile?.type || '',
        extractedJson: { items: reviewLines },
        status: 'in_review',
        uploadedBy: user?.uid || '',
      });
      invoiceId = created.id;

      // Step 2: Upload file (non-blocking — import continues even if upload fails)
      let fileUrl = '';
      let attachmentMeta = null;
      try {
        attachmentMeta = await uploadInvoiceFile(restaurant.id, invoiceId, selectedFile, user?.uid || '');
        fileUrl = attachmentMeta.url;
        await updateInvoice(restaurant.id, invoiceId, { fileUrl, attachment: attachmentMeta });
      } catch (uploadErr) {
        console.warn('Cloudinary upload failed (import continues):', uploadErr.message);
      }

      // Step 3: Create new items for lines with createNew = true (must precede the batch)
      // Any failure here is fatal — we throw so the invoice is marked failed instead of left in_review
      const workingLines = reviewLines.map(l => ({ ...l }));
      for (const line of workingLines) {
        if (!line.createNew || line.linkedItemId) continue;
        if (line.itemType === 'ingredient') {
          const newItem = await createIngredient(restaurant.id, {
            name: line.suggestedName,
            unit: line.unit || '',
            costPerUnit: parseFloat(line.unitPrice) || 0,
            currentStock: 0,
            minStock: 0,
            supplierId: selectedSupplier.id,
            supplierName: selectedSupplier.name,
            createdFrom: 'invoice_import',
          });
          line.linkedItemId = newItem.id;
        } else if (line.itemType === 'resale_product') {
          const newItem = await createResaleProduct(restaurant.id, {
            name: line.suggestedName,
            cost: parseFloat(line.unitPrice) || 0,
            salePrice: 0,
            stockQuantity: 0,
            supplierId: selectedSupplier.id,
            supplierName: selectedSupplier.name,
            createdFrom: 'invoice_import',
          });
          line.linkedItemId = newItem.id;
        }
      }

      // Step 4: Atomic batch — all stock updates + movements + invoice status in one commit
      const { confirmedLines, stockImportedValue, ignoredValue, discrepancy } =
        await confirmInvoiceAtomic(restaurant.id, invoiceId, workingLines, totalAmount);

      const importedCount = confirmedLines.filter(l => l.status === 'imported').length;
      const errorCount    = confirmedLines.filter(l => l.status === 'error').length;

      setSavedResult({
        invoiceId,
        confirmedLines,
        stockLinesImported: importedCount,
        stockUpdateErrors: errorCount,
        stockImportedValue,
        ignoredValue,
        discrepancy,
        totalAmount,
        fileUrl,
        fileMimeType: selectedFile?.type,
      });
      setStep('done');
      toast({ title: 'Nota importada com sucesso!' });
      await loadData();
    } catch (err) {
      // If the invoice was already created, mark it as failed so it is not stuck in_review
      if (invoiceId) {
        try {
          await updateInvoice(restaurant.id, invoiceId, {
            status: 'failed',
            failureReason: err.message || 'Erro desconhecido durante a importação',
          });
        } catch (_) {
          // Best-effort — log silently if this also fails
          console.error('Falha ao registar estado de erro na nota:', _);
        }
      }
      toast({
        title: 'Falha ao importar nota',
        description: err.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckDuplicate = async () => {
    if (!selectedSupplier) return;
    const dup = await checkDuplicateInvoice(
      restaurant.id,
      selectedSupplier.id,
      invoiceHeader.invoiceNumber,
      invoiceHeader.invoiceDate,
      parseFloat(invoiceHeader.totalAmount) || 0
    );
    setDuplicateWarning(dup);
  };

  const resetAll = () => {
    setStep('upload');
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setSelectedSupplier(null);
    setInvoiceHeader({ supplierNameDetected: '', invoiceNumber: '', invoiceDate: '', currency: 'BRL', totalAmount: '' });
    setReviewLines([]);
    setDuplicateWarning(null);
    setSavedResult(null);
    setExtractionError(null);
  };

  if (loadingData) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </Layout>
    );
  }

  // ── STEP: DONE ────────────────────────────────────────────────────────────
  if (step === 'done' && savedResult) {
    const thumbUrl = getCloudinaryThumbnailUrl(savedResult.fileUrl, savedResult.fileMimeType);
    const isPdf = savedResult.fileMimeType === 'application/pdf';
    const hasDiscrepancy = savedResult.discrepancy && Math.abs(savedResult.discrepancy) > 0.01;
    const importedItems = (savedResult.confirmedLines || []).filter(l => l.status === 'imported');
    const ignoredItems  = (savedResult.confirmedLines || []).filter(l => l.status === 'ignored' || l.status === 'skipped');
    const errorItems    = (savedResult.confirmedLines || []).filter(l => l.status === 'error');

    return (
      <Layout>
        <div className="page-container max-w-2xl mx-auto pb-16">

          {/* Header */}
          <div className="flex flex-col items-center text-center pt-10 pb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${savedResult.stockUpdateErrors > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
              <CheckCircle2 className={`w-8 h-8 ${savedResult.stockUpdateErrors > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Nota importada!</h2>
            <p className="text-muted-foreground text-sm">
              {savedResult.stockLinesImported} item(ns) atualizados no estoque com custo médio ponderado.
            </p>
            {savedResult.stockUpdateErrors > 0 && (
              <p className="text-amber-600 text-sm mt-1">
                {savedResult.stockUpdateErrors} item(ns) com erro — verifique abaixo.
              </p>
            )}
          </div>

          {/* Financial summary */}
          <div className="card mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Resumo Financeiro</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total da nota</span>
                <span className="font-semibold">{formatCurrency(savedResult.totalAmount, currency)}</span>
              </div>
              {savedResult.stockImportedValue > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor importado p/ estoque</span>
                  <span className="font-medium text-emerald-700">{formatCurrency(savedResult.stockImportedValue, currency)}</span>
                </div>
              )}
              {savedResult.ignoredValue > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor ignorado / taxas</span>
                  <span className="text-muted-foreground">{formatCurrency(savedResult.ignoredValue, currency)}</span>
                </div>
              )}
              {hasDiscrepancy && (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className={`font-medium ${Math.abs(savedResult.discrepancy) > 1 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    Discrepância
                  </span>
                  <span className={`font-semibold ${Math.abs(savedResult.discrepancy) > 1 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {formatCurrency(savedResult.discrepancy, currency)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Per-item feedback */}
          {importedItems.length > 0 && (
            <div className="card mb-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Itens Importados para o Estoque</h3>
              <div className="space-y-2">
                {importedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      </span>
                      <span className="font-medium">{item.suggestedName || item.confirmedName}</span>
                    </div>
                    <span className="text-emerald-700 font-medium shrink-0 ml-2">{item.addedToStock || `+${item.qty || item.quantity}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ignored items */}
          {ignoredItems.length > 0 && (
            <div className="card mb-4 opacity-70">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Itens Ignorados</h3>
              <div className="space-y-1">
                {ignoredItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.suggestedName || item.rawDescription || 'Item sem nome'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error items */}
          {errorItems.length > 0 && (
            <div className="card mb-4 border-amber-200 bg-amber-50">
              <h3 className="font-semibold text-sm text-amber-700 uppercase tracking-wide mb-3">Itens com Erro</h3>
              <div className="space-y-1">
                {errorItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-amber-700 py-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.suggestedName || item.rawDescription || 'Item sem nome'} — {item.error || 'Erro desconhecido'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachment */}
          {savedResult.fileUrl && (
            <div className="card mb-6 flex items-center gap-4">
              {thumbUrl && !isPdf ? (
                <a href={savedResult.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img src={thumbUrl} alt="Nota fiscal" className="w-16 h-16 object-cover rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow" />
                </a>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Arquivo anexado</p>
                <a href={savedResult.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">
                  Clique para visualizar
                </a>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={resetAll} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Importar outra nota
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── STEP: REVIEW ─────────────────────────────────────────────────────────
  if (step === 'review') {
    const unknownLines = reviewLines.filter(l => l.itemType === 'unknown');
    const unlinkedStockLines = stockLines.filter(l => !l.linkedItemId && !l.createNew);
    const ignoredLines = reviewLines.filter(l => l.itemType === 'ignore');
    const readyStockLines = stockLines.filter(l => l.linkedItemId || l.createNew);
    // Lines that need user-confirmed unit conversion (variable multiplier units)
    const pendingConversionLines = reviewLines.filter(l => l.needsConversion && l.itemType !== 'ignore');
    const unresolvedCount = unknownLines.length + unlinkedStockLines.length + pendingConversionLines.length + (!selectedSupplier ? 1 : 0);
    const canImport = !isSaving && !!selectedSupplier && unknownLines.length === 0 && unlinkedStockLines.length === 0 && pendingConversionLines.length === 0 && !duplicateWarning;

    // Apply a user-entered multiplier to resolve a conversion-pending line.
    // Requires: unit must be selected (not null) AND multiplier > 0.
    const applyUserMultiplier = (idx) => {
      setReviewLines(prev => prev.map((l, i) => {
        if (i !== idx) return l;
        if (!l.unit) return l; // unit must be selected first
        const multiplier = parseFloat(l.userMultiplier);
        if (!multiplier || multiplier <= 0) return l;
        // Use parseSafeNumber-safe origQty (fixes fraction-string edge case)
        const origQty = parseFloat(l._origQuantity ?? l.quantity) || 0;
        const converted = Math.round(origQty * multiplier * 10000) / 10000;
        const lt = parseFloat(l.lineTotal) || 0;
        const newUnitPrice = converted > 0 && lt > 0
          ? String(Math.round(lt / converted * 10000) / 10000)
          : l.unitPrice;
        return {
          ...l,
          quantity: String(converted),
          unitPrice: newUnitPrice,
          needsConversion: false,
          conversionNote: `${origQty} × ${multiplier} = ${converted} ${l.unit} (confirmado pelo usuário)`,
          userMultiplier: '',
        };
      }));
    };

    const getLineStatus = (line) => {
      if (line.itemType === 'ignore') return { label: 'Ignorado', cls: 'bg-gray-100 text-gray-500', Icon: EyeOff };
      if (line.itemType === 'unknown') return { label: 'Precisa de ação', cls: 'bg-amber-100 text-amber-700', Icon: AlertTriangle };
      if (line.linkedItemId) return { label: 'Vinculado', cls: 'bg-green-100 text-green-700', Icon: CheckCircle2 };
      if (line.createNew) return { label: 'Será criado', cls: 'bg-blue-100 text-blue-700', Icon: PlusCircle };
      return { label: 'Precisa de ação', cls: 'bg-amber-100 text-amber-700', Icon: AlertTriangle };
    };

    const getBorderColor = (line) => {
      if (line.itemType === 'ignore') return 'border-l-gray-200';
      if (line.linkedItemId || line.createNew) return 'border-l-emerald-400';
      return 'border-l-amber-400';
    };

    return (
      <Layout>
        <div className="page-container">

          {/* ─── SECTION 1: Header ─────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="page-title">Revisão da Nota Fiscal</h1>
              <p className="page-subtitle">Verifique e ajuste os dados extraídos antes de importar para o estoque.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={resetAll} disabled={isSaving}>Cancelar</Button>
              <Button
                onClick={handleImport}
                disabled={!canImport}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importando...</>
                  : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar e Importar</>}
              </Button>
            </div>
          </div>

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">Possível nota duplicada detectada</p>
                <p className="text-sm mt-0.5">
                  {duplicateWarning.matchType === 'number'
                    ? <>Já existe a Nota Nº <strong>{duplicateWarning.invoiceNumber}</strong> — {formatCurrency(duplicateWarning.totalAmount, currency)} para este fornecedor (mesmo número de nota).</>
                    : <>Já existe uma nota com a mesma data e valor total ({formatCurrency(duplicateWarning.totalAmount, currency)}) para este fornecedor.</>
                  }
                  {' '}Verifique se é uma nota diferente antes de continuar.
                </p>
              </div>
              <button onClick={() => setDuplicateWarning(null)} className="text-amber-400 hover:text-amber-700 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Blocking warnings */}
          {unresolvedCount > 0 && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800 space-y-1">
                <p className="font-medium">Não é possível importar — resolva os itens pendentes:</p>
                {!selectedSupplier && <p>• Nenhum fornecedor selecionado para esta nota.</p>}
                {unknownLines.length > 0 && <p>• {unknownLines.length} item(ns) marcados como "Desconhecido" — classifique ou marque como Ignorar.</p>}
                {unlinkedStockLines.length > 0 && <p>• {unlinkedStockLines.length} item(ns) de estoque sem vínculo — vincule a um item existente ou marque "Criar novo".</p>}
              </div>
            </div>
          )}

          {/* ─── SECTION 2: Invoice Summary ────────────────────────────── */}
          <div className="card mb-6">
            <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-muted-foreground" />
              Dados da Nota
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

              {/* Supplier */}
              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="mb-1.5 block">
                  Fornecedor <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-md text-sm bg-background hover:bg-muted/50 transition-colors ${
                      !selectedSupplier ? 'border-red-300 bg-red-50' : 'border-border'
                    }`}
                    onClick={() => setShowSupplierDropdown(v => !v)}
                  >
                    <span className={`flex items-center gap-2 ${!selectedSupplier ? 'text-red-500' : 'text-foreground'}`}>
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      {selectedSupplier ? selectedSupplier.name : 'Selecione um fornecedor'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {showSupplierDropdown && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {suppliers.map(s => (
                        <button
                          key={s.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                          onClick={() => { setSelectedSupplier(s); setShowSupplierDropdown(false); }}
                        >
                          {s.name}
                        </button>
                      ))}
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-emerald-600 font-medium hover:bg-emerald-50 border-t border-border"
                        onClick={() => { setShowNewSupplierForm(true); setShowSupplierDropdown(false); }}
                      >
                        <Plus className="w-3 h-3 inline mr-1" /> Novo fornecedor
                      </button>
                    </div>
                  )}
                </div>
                {showNewSupplierForm && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="Nome do fornecedor"
                      value={newSupplierName}
                      onChange={e => setNewSupplierName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateSupplier()}
                      className="text-sm"
                    />
                    <Button size="sm" onClick={handleCreateSupplier} disabled={creatingSupplier} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                      {creatingSupplier ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Criar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewSupplierForm(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {invoiceHeader.supplierNameDetected && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    IA detectou: <em className="font-medium">{invoiceHeader.supplierNameDetected}</em>
                  </p>
                )}
              </div>

              {/* Invoice number */}
              <div>
                <Label className="mb-1.5 block">Nº da Nota</Label>
                <Input
                  value={invoiceHeader.invoiceNumber}
                  onChange={e => setInvoiceHeader(h => ({ ...h, invoiceNumber: e.target.value }))}
                  onBlur={handleCheckDuplicate}
                  placeholder="Ex: NF-0001"
                />
              </div>

              {/* Date */}
              <div>
                <Label className="mb-1.5 block">Data da Nota</Label>
                <Input
                  type="date"
                  value={invoiceHeader.invoiceDate}
                  onChange={e => setInvoiceHeader(h => ({ ...h, invoiceDate: e.target.value }))}
                  onBlur={handleCheckDuplicate}
                />
              </div>

              {/* Total */}
              <div>
                <Label className="mb-1.5 block">Valor Total</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoiceHeader.totalAmount}
                  onChange={e => setInvoiceHeader(h => ({ ...h, totalAmount: e.target.value }))}
                  onBlur={handleCheckDuplicate}
                  placeholder="0,00"
                />
              </div>

              {/* Currency */}
              <div>
                <Label className="mb-1.5 block">Moeda</Label>
                <Input
                  value={invoiceHeader.currency}
                  onChange={e => setInvoiceHeader(h => ({ ...h, currency: e.target.value }))}
                  placeholder="BRL"
                />
              </div>
            </div>
          </div>

          {/* ─── SECTION 3: Items ──────────────────────────────────────── */}

          {/* Counter bar */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold">
                {reviewLines.length}
              </span>
              <span className="text-muted-foreground">extraídos</span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                {readyStockLines.length}
              </span>
              <span className="text-muted-foreground">para estoque</span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">
                {ignoredLines.length}
              </span>
              <span className="text-muted-foreground">ignorados</span>
            </div>
            {(unknownLines.length + unlinkedStockLines.length) > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                    {unknownLines.length + unlinkedStockLines.length}
                  </span>
                  <span className="text-amber-700 font-medium">pendentes</span>
                </div>
              </>
            )}
            {pendingConversionLines.length > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
                    {pendingConversionLines.length}
                  </span>
                  <span className="text-orange-700 font-medium">conversão pendente</span>
                </div>
              </>
            )}
          </div>

          {/* Helper text */}
          <div className="mb-4 text-xs text-muted-foreground space-y-0.5">
            <p>Itens marcados como <strong>Ignorar</strong> serão salvos na nota, mas não entrarão no estoque.</p>
            <p>Itens <strong>Desconhecidos</strong> precisam ser classificados ou ignorados antes da importação.</p>
            <p className="text-amber-600">
              ⚠ Confira se a <strong>quantidade</strong> representa o total real (ex: 6 Kg, não 3 caixas).
              O preço unitário é recalculado automaticamente após conversão.
            </p>
          </div>

          {/* Item cards */}
          <div className="space-y-4 mb-28">
            {reviewLines.map((line, idx) => {
              const options = getItemOptions(line.itemType);
              const isStock = line.itemType === 'ingredient' || line.itemType === 'resale_product';
              const { label: statusLabel, cls: statusCls, Icon: StatusIcon } = getLineStatus(line);
              const isUnresolved = line.itemType === 'unknown' || (isStock && !line.linkedItemId && !line.createNew);

              return (
                <div
                  key={line._id}
                  className={`card border-l-4 ${getBorderColor(line)} ${line.itemType === 'ignore' ? 'opacity-60' : ''} ${isUnresolved ? 'ring-1 ring-amber-200' : ''}`}
                >
                  {/* Row A: raw description + status badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1 min-w-0">
                      <span className="font-medium text-foreground/50 mr-1">Original:</span>
                      {line.rawDescription || <em>sem descrição</em>}
                    </p>
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${statusCls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusLabel}
                    </span>
                  </div>

                  {/* Conversion pending warning */}
                  {line.needsConversion && (
                    <div className="mb-3 rounded-md border border-orange-200 bg-orange-50 p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Conversão de embalagem pendente
                      </div>
                      {line.conversionNote && (
                        <p className="text-xs text-orange-600">{line.conversionNote}</p>
                      )}

                      {/* Step 1: unit selection required when unit is null */}
                      {!line.unit && (
                        <p className="text-xs font-medium text-orange-700">
                          ① Selecione a unidade final no campo <strong>Unidade</strong> abaixo (ex: Kg, L, uni).
                        </p>
                      )}

                      {/* Step 2: multiplier input */}
                      <p className="text-xs text-orange-600">
                        {line.unit
                          ? <>② Informe quantas <strong>{line.unit}</strong> há em cada embalagem:</>
                          : <>② Depois informe a quantidade por embalagem:</>
                        }
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground shrink-0">
                          {line._origQuantity ?? line.quantity} emb. ×
                        </span>
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          className="h-8 w-28 text-sm"
                          placeholder="ex: 12"
                          value={line.userMultiplier}
                          onChange={e => updateLine(idx, 'userMultiplier', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && applyUserMultiplier(idx)}
                          disabled={!line.unit}
                        />
                        <span className="text-xs text-muted-foreground shrink-0">
                          {line.unit ? `${line.unit}/emb.` : '(selecione a unidade primeiro)'}
                        </span>
                        <button
                          onClick={() => applyUserMultiplier(idx)}
                          disabled={!line.unit || !parseFloat(line.userMultiplier)}
                          className="text-xs px-3 py-1.5 rounded-md bg-orange-600 text-white font-medium disabled:opacity-40 hover:bg-orange-700 transition-colors"
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Conversion note (resolved) */}
                  {!line.needsConversion && line.conversionNote && (
                    <div className="mb-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-2.5 py-1.5">
                      ✓ Convertido: {line.conversionNote}
                    </div>
                  )}

                  {/* Row B: editable name + type selector */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">Nome do item</Label>
                      <Input
                        className="font-medium"
                        value={line.suggestedName}
                        onChange={e => updateLine(idx, 'suggestedName', e.target.value)}
                        placeholder="Nome do item"
                      />
                    </div>
                    <div className="shrink-0">
                      <Label className="text-xs mb-1 block">Tipo</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {Object.keys(ITEM_TYPE_LABELS).map(type => (
                          <button
                            key={type}
                            onClick={() => {
                              updateLine(idx, 'itemType', type);
                              if (type === 'ignore' || type === 'unknown') {
                                updateLine(idx, 'linkedItemId', null);
                                updateLine(idx, 'createNew', false);
                              }
                            }}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                              line.itemType === type
                                ? ITEM_TYPE_COLORS[type] + ' border-transparent'
                                : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
                            }`}
                          >
                            {ITEM_TYPE_LABELS[type]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row C: quantities */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div>
                      <Label className="text-xs mb-1 block">Quantidade</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={line.quantity}
                        onChange={e => updateLine(idx, 'quantity', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Unidade</Label>
                      <Select value={line.unit || ''} onValueChange={v => updateLine(idx, 'unit', v)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALLOWED_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Preço unitário</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={e => updateLine(idx, 'unitPrice', e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Total da linha</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.lineTotal}
                        onChange={e => updateLine(idx, 'lineTotal', e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  {/* Row D: linking area (only for stock items) */}
                  {isStock && (
                    <div className="pt-4 border-t border-border">
                      <Label className="text-xs mb-2 block text-muted-foreground font-medium uppercase tracking-wide">
                        Vínculo com estoque
                      </Label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          className="flex-1 text-sm border border-border rounded-md px-3 py-2 bg-background"
                          value={line.linkedItemId || ''}
                          onChange={e => {
                            updateLine(idx, 'linkedItemId', e.target.value || null);
                            if (e.target.value) updateLine(idx, 'createNew', false);
                          }}
                        >
                          <option value="">— Selecionar item existente —</option>
                          {options.map(opt => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}{opt.unit ? ` (${opt.unit})` : ''}
                            </option>
                          ))}
                        </select>

                        {!line.linkedItemId && (
                          <button
                            onClick={() => updateLine(idx, 'createNew', !line.createNew)}
                            className={`flex items-center justify-center gap-1.5 text-sm px-4 py-2 rounded-md border transition-colors shrink-0 font-medium ${
                              line.createNew
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-border text-muted-foreground hover:border-blue-500 hover:text-blue-600'
                            }`}
                          >
                            <PlusCircle className="w-4 h-4" />
                            {line.createNew ? 'Será criado' : 'Criar novo item'}
                          </button>
                        )}

                        {line.linkedItemId && (
                          <button
                            onClick={() => updateLine(idx, 'linkedItemId', null)}
                            className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-md shrink-0 hover:bg-emerald-100 transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            Vinculado · Remover
                          </button>
                        )}
                      </div>

                      {/* Feedback text */}
                      {!line.linkedItemId && !line.createNew && (
                        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Selecione um item existente ou marque "Criar novo item" para atualizar o estoque.
                        </p>
                      )}
                      {line.createNew && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1.5">
                          <PlusCircle className="w-3 h-3 shrink-0" />
                          Um novo {line.itemType === 'ingredient' ? 'ingrediente' : 'produto de revenda'} será criado ao importar.
                        </p>
                      )}
                      {line.linkedItemId && (
                        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          Estoque e custo médio serão atualizados para este item.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sticky bottom action bar */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-border shadow-lg px-4 py-3">
            <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
              <div className="text-sm">
                {canImport ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Pronto para importar — {readyStockLines.length} item(ns) afetarão o estoque.
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    {unresolvedCount} pendência(s) impedem a importação.
                  </span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" onClick={resetAll} disabled={isSaving}>Cancelar</Button>
                <Button
                  onClick={handleImport}
                  disabled={!canImport}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importando...</>
                    : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar e Importar</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── STEP: UPLOAD ──────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="page-container max-w-2xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Importar Nota Fiscal</h1>
          <p className="page-subtitle">A IA extrai os dados automaticamente para revisão.</p>
        </div>
      </div>

      {/* Supplier selection */}
      <div className="card mb-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          Fornecedor
          <span className="text-xs text-muted-foreground font-normal">(pode selecionar depois)</span>
        </h3>
        <div className="relative">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-md text-sm bg-background hover:bg-muted/50"
            onClick={() => setShowSupplierDropdown(v => !v)}
          >
            <span>{selectedSupplier ? selectedSupplier.name : <span className="text-muted-foreground">Selecione o fornecedor desta nota...</span>}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showSupplierDropdown && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
              {suppliers.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
              )}
              {suppliers.map(s => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                  onClick={() => { setSelectedSupplier(s); setShowSupplierDropdown(false); }}
                >
                  {s.name}
                </button>
              ))}
              <button
                className="w-full text-left px-3 py-2 text-sm text-emerald-600 font-medium hover:bg-emerald-50 border-t border-border"
                onClick={() => { setShowNewSupplierForm(true); setShowSupplierDropdown(false); }}
              >
                <Plus className="w-3 h-3 inline mr-1" /> Novo fornecedor
              </button>
            </div>
          )}
        </div>

        {showNewSupplierForm && (
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Nome do fornecedor"
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateSupplier()}
            />
            <Button onClick={handleCreateSupplier} disabled={creatingSupplier} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
              {creatingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
            </Button>
            <Button variant="ghost" onClick={() => setShowNewSupplierForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* File upload */}
      <div className="card mb-4">
        <h3 className="font-semibold text-foreground mb-3">Nota Fiscal</h3>

        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-emerald-400 bg-emerald-50' : 'border-border hover:border-emerald-400 hover:bg-muted/30'
            }`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Clique ou arraste o arquivo aqui</p>
            <p className="text-xs text-muted-foreground mt-1">Imagem (JPG, PNG, WEBP) ou PDF</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={e => handleFileSelect(e.target.files[0])}
            />
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            {filePreviewUrl ? (
              <img src={filePreviewUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-border" />
            ) : (
              <div className="w-20 h-20 bg-red-50 rounded-lg border border-border flex items-center justify-center">
                <FileText className="w-8 h-8 text-red-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedFile(null); setFilePreviewUrl(null); setExtractionError(null); }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Quality hint */}
      {!selectedFile && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2 text-xs text-blue-700">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
          <span>
            <strong>Dica para melhor leitura:</strong> Prefira PDF original ou imagem escaneada, bem iluminada, sem sombras, cortes ou fundo poluído. Fotos tortas ou de baixa resolução podem reduzir a precisão da extração.
          </span>
        </div>
      )}

      {extractionError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{extractionError}</span>
        </div>
      )}

      <Button
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base font-semibold"
        disabled={!selectedFile || isExtracting}
        onClick={handleExtract}
      >
        {isExtracting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Analisando com IA...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Analisar com IA
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground mt-3">
        Os dados serão extraídos e apresentados para revisão antes de qualquer importação.
      </p>
    </div>
    </Layout>
  );
};

export default PurchasesPage;
