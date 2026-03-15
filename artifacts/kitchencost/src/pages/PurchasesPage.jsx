import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, Plus, X, ReceiptText, Sparkles, Link2, PlusCircle,
} from 'lucide-react';
import {
  getSuppliers, createSupplier,
  getIngredients, getResaleProducts,
  createInvoice, updateInvoice,
  checkDuplicateInvoice, importInvoiceLineToStock,
} from '../lib/firestore';
import { extractInvoiceFromFile } from '../lib/aiExtraction';
import { uploadInvoiceFile, validateInvoiceFile, getCloudinaryThumbnailUrl } from '../lib/invoiceStorage';

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

const formatCurrency = (val, currency = 'BRL') => {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency });
};

const PurchasesPage = () => {
  const { restaurant, user } = useAuth();
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
        // Upload failed — continue without file URL, will be saved as empty
        console.warn('Cloudinary upload failed:', uploadErr.message);
      }

      const confirmedLines = [];
      let stockUpdateErrors = 0;

      for (const line of reviewLines) {
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
          } catch {
            stockUpdateErrors++;
          }
          confirmedLines.push({ ...line, qty, unitPrice, lineTotal, status: 'imported' });
        } else {
          confirmedLines.push({ ...line, status: line.createNew ? 'pending_creation' : 'ignored' });
        }
      }

      await updateInvoice(restaurant.id, invoiceId, {
        fileUrl,
        attachment: attachmentMeta || null,
        confirmedJson: { items: confirmedLines },
        status: stockUpdateErrors > 0 ? 'with_divergence' : 'imported',
      });

      setSavedResult({
        invoiceId,
        stockLinesImported: stockLines.filter(l => l.linkedItemId).length,
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
    if (!selectedSupplier || !invoiceHeader.invoiceNumber) return;
    const dup = await checkDuplicateInvoice(
      restaurant.id,
      selectedSupplier.id,
      invoiceHeader.invoiceNumber,
      parseFloat(invoiceHeader.totalAmount)
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // ── STEP: DONE ────────────────────────────────────────────────────────────
  if (step === 'done' && savedResult) {
    const thumbUrl = getCloudinaryThumbnailUrl(savedResult.fileUrl, savedResult.fileMimeType);
    const isPdf = savedResult.fileMimeType === 'application/pdf';
    return (
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
          <p className="text-muted-foreground text-sm mt-1">
            Total da nota: {formatCurrency(savedResult.totalAmount)}
          </p>

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
    );
  }

  // ── STEP: REVIEW ─────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Revisão da Nota Fiscal</h1>
            <p className="page-subtitle">Verifique e ajuste os dados antes de importar.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetAll}>Cancelar</Button>
            <Button
              onClick={handleImport}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Importar
            </Button>
          </div>
        </div>

        {duplicateWarning && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Possível nota duplicada: Nº {duplicateWarning.invoiceNumber} — {formatCurrency(duplicateWarning.totalAmount)}.
              Confirme antes de importar.
            </span>
            <button onClick={() => setDuplicateWarning(null)} className="ml-auto text-amber-500 hover:text-amber-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Invoice header */}
        <div className="card mb-6">
          <h3 className="font-semibold text-foreground mb-4">Dados da Nota</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Fornecedor</Label>
              <div className="relative mt-1">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 border border-border rounded-md text-sm bg-background hover:bg-muted/50"
                  onClick={() => setShowSupplierDropdown(v => !v)}
                >
                  <span>{selectedSupplier ? selectedSupplier.name : <span className="text-muted-foreground">Selecione um fornecedor</span>}</span>
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
                <p className="text-xs text-muted-foreground mt-1">
                  IA detectou: <em>{invoiceHeader.supplierNameDetected}</em>
                </p>
              )}
            </div>

            <div>
              <Label>Nº da Nota</Label>
              <Input
                className="mt-1"
                value={invoiceHeader.invoiceNumber}
                onChange={e => setInvoiceHeader(h => ({ ...h, invoiceNumber: e.target.value }))}
                onBlur={handleCheckDuplicate}
                placeholder="Ex: NF-0001"
              />
            </div>

            <div>
              <Label>Data da Nota</Label>
              <Input
                type="date"
                className="mt-1"
                value={invoiceHeader.invoiceDate}
                onChange={e => setInvoiceHeader(h => ({ ...h, invoiceDate: e.target.value }))}
              />
            </div>

            <div>
              <Label>Valor Total</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                value={invoiceHeader.totalAmount}
                onChange={e => setInvoiceHeader(h => ({ ...h, totalAmount: e.target.value }))}
              />
            </div>

            <div>
              <Label>Moeda</Label>
              <Input
                className="mt-1"
                value={invoiceHeader.currency}
                onChange={e => setInvoiceHeader(h => ({ ...h, currency: e.target.value }))}
                placeholder="BRL"
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Itens Extraídos ({reviewLines.length})
          </h3>
          <span className="text-xs text-muted-foreground">
            {stockLines.length} para estoque · {reviewLines.filter(l => l.itemType === 'ignore').length} ignorados
          </span>
        </div>

        <div className="space-y-3 mb-8">
          {reviewLines.map((line, idx) => {
            const options = getItemOptions(line.itemType);
            const isStock = line.itemType === 'ingredient' || line.itemType === 'resale_product';
            return (
              <div key={line._id} className={`card border ${line.itemType === 'ignore' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{line.rawDescription}</p>
                    <Input
                      className="mt-1 font-medium"
                      value={line.suggestedName}
                      onChange={e => updateLine(idx, 'suggestedName', e.target.value)}
                      placeholder="Nome do item"
                    />
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {Object.keys(ITEM_TYPE_LABELS).map(type => (
                      <button
                        key={type}
                        onClick={() => updateLine(idx, 'itemType', type)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                          line.itemType === type
                            ? ITEM_TYPE_COLORS[type] + ' border-transparent font-medium'
                            : 'border-border text-muted-foreground hover:border-primary'
                        }`}
                      >
                        {ITEM_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      step="0.001"
                      className="mt-1 text-sm"
                      value={line.quantity}
                      onChange={e => updateLine(idx, 'quantity', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Input
                      className="mt-1 text-sm"
                      value={line.unit}
                      onChange={e => updateLine(idx, 'unit', e.target.value)}
                      placeholder="kg, un, L..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Preço unit.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 text-sm"
                      value={line.unitPrice}
                      onChange={e => updateLine(idx, 'unitPrice', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Total linha</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 text-sm"
                      value={line.lineTotal}
                      onChange={e => updateLine(idx, 'lineTotal', e.target.value)}
                    />
                  </div>
                </div>

                {isStock && (
                  <div className="border-t border-border pt-3">
                    <Label className="text-xs">Vincular a item existente</Label>
                    <div className="flex gap-2 mt-1">
                      <select
                        className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-background"
                        value={line.linkedItemId || ''}
                        onChange={e => updateLine(idx, 'linkedItemId', e.target.value || null)}
                      >
                        <option value="">— Selecione —</option>
                        {options.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.name}{opt.unit ? ` (${opt.unit})` : ''}</option>
                        ))}
                      </select>
                      {!line.linkedItemId && (
                        <button
                          onClick={() => updateLine(idx, 'createNew', !line.createNew)}
                          className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                            line.createNew
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'border-border text-muted-foreground hover:border-emerald-600 hover:text-emerald-600'
                          }`}
                        >
                          <PlusCircle className="w-3 h-3" />
                          Criar novo
                        </button>
                      )}
                      {line.linkedItemId && (
                        <div className="flex items-center gap-1 text-xs text-emerald-600">
                          <Link2 className="w-3 h-3" />
                          Vinculado
                        </div>
                      )}
                    </div>
                    {!line.linkedItemId && !line.createNew && (
                      <p className="text-xs text-amber-600 mt-1">
                        Vincule a um item ou marque "Criar novo" para atualizar o estoque.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 sticky bottom-4">
          <Button variant="outline" onClick={resetAll}>Cancelar</Button>
          <Button
            onClick={handleImport}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirmar e Importar
          </Button>
        </div>
      </div>
    );
  }

  // ── STEP: UPLOAD ──────────────────────────────────────────────────────────
  return (
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
  );
};

export default PurchasesPage;
