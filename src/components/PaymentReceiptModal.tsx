import React from 'react';
import { 
  Printer, 
  X, 
  Share2, 
  CheckCircle2, 
  Building2, 
  Phone, 
  MapPin, 
  Calendar, 
  Receipt as ReceiptIcon,
  CreditCard
} from 'lucide-react';
import { Customer, CustomerLedgerTransaction, BusinessProfile } from '../types';
import { formatINR, paiseToRupees } from '../services/currency';

interface PaymentReceiptModalProps {
  customer: Customer;
  transaction: CustomerLedgerTransaction;
  businessProfile?: BusinessProfile | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  customer,
  transaction,
  businessProfile,
  onClose
}) => {
  const bizName = businessProfile?.name || 'ORIGINAL MODI BAGS';
  const bizTagline = businessProfile?.tagline || 'Prop. Ratan Modi • Bag Manufacturer & Wholesale Mandi';
  const bizAddress = businessProfile?.address || '3, Amartalla Lane (Near Canning Street), Kolkata - 700001';
  const bizPhone = businessProfile?.phone || '+91 98300 00000';
  const bizGstin = businessProfile?.gstin || '19ABCDE1234F1Z5';

  const receiptNo = transaction.referenceDocumentNumber || `REC-${transaction.id.slice(-6).toUpperCase()}`;
  const receiptDate = new Date(transaction.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const rawNumber = (customer.whatsapp || customer.mobile || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;

    const message = `*PAYMENT RECEIPT - ${bizName}*
----------------------------------------
*Receipt No:* ${receiptNo}
*Date:* ${receiptDate}
*Customer:* ${customer.name} (${customer.businessName || 'Wholesale Buyer'})
*Amount Received:* ${formatINR(transaction.creditPaise)}
*Mode:* ${transaction.paymentMethod || 'CASH'}
*Particulars:* ${transaction.description}
----------------------------------------
*Current Outstanding Balance:* ${formatINR(transaction.runningBalancePaise)}
----------------------------------------
Thank you for your business!
_${bizAddress}_
_Ph: ${bizPhone}_`;

    const encoded = encodeURIComponent(message);
    const url = phoneWithCountry
      ? `https://wa.me/${phoneWithCountry}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#1C1C24] border border-[#333345] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header Actions */}
        <div className="p-3.5 border-b border-[#2C2C3A] flex items-center justify-between bg-[#15151D] print:hidden">
          <div className="flex items-center gap-2">
            <ReceiptIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Official Payment Receipt
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleWhatsAppShare}
              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-all"
              title="Send to Customer WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-semibold flex items-center gap-1 transition-all"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#252533] text-gray-400 hover:text-white transition-all ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-5 overflow-y-auto bg-white text-zinc-900 font-sans print:p-0 print:m-0">
          {/* Business Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-3">
            <h2 className="text-base sm:text-lg font-black tracking-tight uppercase text-zinc-950">
              {bizName}
            </h2>
            <p className="text-[11px] font-semibold text-zinc-700">
              {bizTagline}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {bizAddress}
            </p>
            <div className="flex justify-center gap-3 text-[10px] text-zinc-600 font-mono mt-1">
              <span>Mob: {bizPhone}</span>
              {bizGstin && <span>GSTIN: {bizGstin}</span>}
            </div>
            <div className="inline-block mt-2 px-3 py-0.5 bg-zinc-900 text-white text-[10px] font-bold rounded tracking-wider uppercase">
              PAYMENT MONEY RECEIPT
            </div>
          </div>

          {/* Receipt & Customer Details */}
          <div className="grid grid-cols-2 gap-2 text-xs py-3 border-b border-zinc-300">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Receipt Number</span>
              <span className="font-mono font-bold text-zinc-900">{receiptNo}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Date & Time</span>
              <span className="font-mono text-zinc-800 text-[11px]">{receiptDate}</span>
            </div>
            <div className="col-span-2 pt-1 border-t border-dashed border-zinc-200">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Received With Thanks From</span>
              <div className="font-bold text-zinc-950 text-sm">{customer.name}</div>
              {customer.businessName && (
                <div className="text-zinc-700 font-medium text-xs">{customer.businessName}</div>
              )}
              <div className="text-[11px] text-zinc-600">
                {customer.city ? `${customer.city} • ` : ''}Ph: {customer.mobile}
              </div>
            </div>
          </div>

          {/* Payment Amount Callout */}
          <div className="my-4 p-3 bg-emerald-50 border-2 border-emerald-600 rounded-xl text-center">
            <span className="text-[11px] text-emerald-800 uppercase tracking-wider font-bold block">
              Amount Received
            </span>
            <div className="text-2xl font-black font-mono text-emerald-950 my-0.5">
              {formatINR(transaction.creditPaise)}
            </div>
            <div className="text-[11px] text-emerald-800 font-medium capitalize">
              Mode: <span className="font-bold">{transaction.paymentMethod || 'CASH'}</span>
            </div>
          </div>

          {/* Particulars & Balance Ledger Impact */}
          <div className="space-y-1.5 text-xs border-b border-zinc-300 pb-3">
            <div className="flex justify-between text-zinc-700">
              <span className="font-semibold">Particulars:</span>
              <span className="text-right text-zinc-900 max-w-[200px] truncate">{transaction.description}</span>
            </div>
            <div className="flex justify-between text-zinc-700 pt-1 border-t border-dashed border-zinc-200">
              <span>Remaining Outstanding Balance:</span>
              <span className="font-mono font-bold text-zinc-950 text-sm">
                {formatINR(transaction.runningBalancePaise)}
              </span>
            </div>
            {customer.creditLimitPaise ? (
              <div className="flex justify-between text-zinc-500 text-[11px]">
                <span>Credit Limit:</span>
                <span className="font-mono">{formatINR(customer.creditLimitPaise)}</span>
              </div>
            ) : null}
          </div>

          {/* Signature & Disclaimer */}
          <div className="pt-6 flex justify-between items-end text-[10px] text-zinc-600">
            <div>
              <p>• Subject to Kolkata Jurisdiction</p>
              <p>• Cheque/NEFT subject to realization</p>
            </div>
            <div className="text-center">
              <div className="w-28 border-b border-zinc-800 mb-1"></div>
              <span className="font-bold text-zinc-800">Authorized Signatory</span>
            </div>
          </div>
        </div>

        {/* Footer Close */}
        <div className="p-3 bg-[#15151D] border-t border-[#2C2C3A] flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#28283A] hover:bg-[#34344E] text-white text-xs font-bold transition-all"
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
