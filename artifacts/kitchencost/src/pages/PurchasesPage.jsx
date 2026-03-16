import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  checkDuplicateInvoice, importInvoiceLineToStock,
} from '../lib/firestore';
import { extractInvoiceFromFile } from '../lib/aiExtraction';
import { uploadInvoiceFile, validateInvoiceFile, getCloudinaryThumbnailUrl } from '../lib/invoiceStorage';
import { formatCurrency } from '../lib/utils';

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

      setReviewLines((result.items || []).map((item, idx) => ({
        _id: idx,
        rawDescription: item.raw_description || '',
        suggestedName: item.suggested_name || item.raw_description || '',
        quantity: item.quantity != null ? String(item.quantity) : '',
        unit: item.unit || '',
        unitPrice: item.unit_price != null ? String(item.unit_price) : '',
        lineTotal: item.line_total != null ? String(item.line_total) : '',
        itemType: item.suggested_item_type || 'unknown',
        linkedItemId: null,
        createNew: false,
      })));

      setStep('review');
    } catch (err) {
      setExtractionError(err.message || 'Erro na extração com IA. Tente novamente.');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateLine = (idx, field, value) => {
    setReviewLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
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
    try {
      const { id: invoiceId } = await createInvoice(restaurant.id, {
        supplierId: selectedSupplier.id,
        supplierNameSnapshot: selectedSupplier.name,
        supplierNameDetected: invoiceHeader.supplierNameDetected,
        invoiceNumber: invoiceHeader.invoiceNumber,
        invoiceDate: invoiceHeader.invoiceDate,
        currency: invoiceHeader.currency,
        totalAmount: parseFloat(invoiceHeader.totalAmount) || 0,
        fileUrl: '',
        fileType: selectedFile?.type || '',
        extractedJson: { items: reviewLines },
        status: 'in_review',
        uploadedBy: user?.uid || '',
      });

      let fileUrl = '';
      let attachmentMeta = null;
      try {
        attachmentMeta = await uploadInvoiceFile(restaurant.id, invoiceId, selectedFile, user?.uid || '');
        fileUrl = attachmentMeta.url;
      } catch (uploadErr) {
        console.warn('Cloudinary upload failed:', uploadErr.message);
      }

      // Work on a mutable copy so we can store newly created item IDs
      const workingLines = reviewLines.map(l => ({ ...l }));
      let stockUpdateErrors = 0;

      // First pass: create new items for lines with createNew = true
      for (const line of workingLines) {
        if (!line.createNew || line.linkedItemId) continue;
        try {
          if (line.itemType === 'ingredient') {
            const newItem = await createIngredient(restaurant.id, {
              name: line.suggestedName,
              unit: line.unit || '',
              costPerUnit: 0,
              currentStock: 0,
              minStock: 0,
            });
            line.linkedItemId = newItem.id;
          } else if (line.itemType === 'resale_product') {
            const newItem = await createResaleProduct(restaurant.id, {
              name: line.suggestedName,
              cost: 0,
              salePrice: 0,
              stockQuantity: 0,
            });
            line.linkedItemId = newItem.id;
          }
        } catch (err) {
          console.error('Falha ao criar item:', err);
          stockUpdateErrors++;
        }
      }

      // Second pass: import stock for all linked lines
      const confirmedLines = [];
      for (const line of workingLines) {
        const qty = parseFloat(line.quantity) || 0;
        const unitPrice = parseFloat(line.unitPrice) || 0;
        const lineTotal = parseFloat(line.lineTotal) || qty * unitPrice;

        if ((line.itemType === 'ingredient' || line.itemType === 'resale_product') && line.linkedItemId) {
          try {
            await importInvoiceLineToStock(restaurant.id, invoiceId, {
              linkedItemId: line.linkedItemId,
              itemType: line.itemType,
              confirmedName: line.suggestedName,
              rawDescription: line.rawDescription,
              quantity: qty,
              unit: line.unit,
              unitPrice,
              lineTotal,
            });
            confirmedLines.push({ ...line, qty, unitPrice, lineTotal, status: 'imported' });
          } catch {
            stockUpdateErrors++;
            confirmedLines.push({ ...line, status: 'error' });
          }
        } else {
          confirmedLines.push({ ...line, status: line.itemType === 'ignore' ? 'ignored' : 'skipped' });
        }
      }

      const stockImportedValue = confirmedLines
        .filter(l => l.status === 'imported')
        .reduce((sum, l) => sum + (l.lineTotal || 0), 0);

      const ignoredValue = confirmedLines
        .filter(l => l.status === 'ignored' || l.status === 'skipped')
        .reduce((sum, l) => sum + (l.lineTotal || 0), 0);

      await updateInvoice(restaurant.id, invoiceId, {
        fileUrl,
        attachment: attachmentMeta || null,
        confirmedJson: { items: confirmedLines },
        stockImportedValue,
        ignoredValue,
        status: stockUpdateErrors > 0 ? 'with_divergence' : 'imported',
      });

      const importedCount = confirmedLines.filter(l => l.status === 'imported').length;

      setSavedResult({
        invoiceId,
        stockLinesImported: importedCount,
        stockImportedValue,
        ignoredValue,
        totalAmount: parseFloat(invoiceHeader.totalAmount) || 0,
        stockUpdateErrors,
        fileUrl,
        fileMimeType: selectedFile?.type,
      });
      setStep('done');
      toast({ title: 'Nota importada com sucesso!' });
      await loadData();
    } catch (err) {
      toast({ title: 'Erro ao importar nota', description: err.message, variant: 'destructive' });
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
    return (
      <Layout>
        <div className="page-container max-w-xl mx-auto">
        <div className="flex flex-col items-center text-center py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Nota importada!</h2>
          <p className="text-muted-foreground mb-1">
            {savedResult.stockLinesImported} item(ns) atualizados no estoque com custo médio ponderado.
          </p>
          {savedResult.stockUpdateErrors > 0 && (
            <p className="text-amber-600 text-sm mt-1">
              {savedResult.stockUpdateErrors} item(ns) não puderam ser atualizados.
            </p>
          )}
          <div className="mt-3 text-sm space-y-1 bg-muted/40 rounded-xl p-4 text-left w-full">
            <div className="flex justify-between"><span className="text-muted-foreground">Total da nota:</span><span className="font-medium">{formatCurrency(savedResult.totalAmount, currency)}</span></div>
            {savedResult.stockImportedValue > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Valor importado p/ estoque:</span><span className="font-medium text-emerald-700">{formatCurrency(savedResult.stockImportedValue, currency)}</span></div>}
            {savedResult.ignoredValue > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Valor ignorado / taxas:</span><span className="text-muted-foreground">{formatCurrency(savedResult.ignoredValue, currency)}</span></div>}
          </div>

          {savedResult.fileUrl && (
            <div className="mt-6 flex flex-col items-center gap-2">
              {thumbUrl && !isPdf ? (
                <a href={savedResult.fileUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={thumbUrl}
                    alt="Nota fiscal"
                    className="w-24 h-24 object-cover rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
                  />
                </a>
              ) : (
                <a
                  href={savedResult.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-600 font-medium hover:underline"
                >
                  <FileText className="w-4 h-4" />
                  Ver PDF da nota fiscal
                </a>
              )}
              <p className="text-xs text-muted-foreground">Arquivo salvo — clique para visualizar</p>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <Button onClick={resetAll} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Importar outra nota
            </Button>
          </div>
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
    const unresolvedCount = unknownLines.length + unlinkedStockLines.length + (!selectedSupplier ? 1 : 0);
    const canImport = !isSaving && !!selectedSupplier && unknownLines.length === 0 && unlinkedStockLines.length === 0 && !duplicateWarning;

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
            {unresolvedCount > 0 && (
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
          </div>

          {/* Helper text */}
          <div className="mb-4 text-xs text-muted-foreground space-y-0.5">
            <p>Itens marcados como <strong>Ignorar</strong> serão salvos na nota, mas não entrarão no estoque.</p>
            <p>Itens <strong>Desconhecidos</strong> precisam ser classificados ou ignorados antes da importação.</p>
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
                      <Input
                        value={line.unit}
                        onChange={e => updateLine(idx, 'unit', e.target.value)}
                        placeholder="kg, un, L..."
                      />
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
