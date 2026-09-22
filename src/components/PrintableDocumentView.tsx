import React from 'react';
import { Bill, MasterPrintSettings, PrintPaperSize } from '../types';
import { paiseToRupees, formatINR } from '../services/currency';

interface PrintableDocumentViewProps {
  bill: Bill;
  settings: MasterPrintSettings;
  format: PrintPaperSize;
  isReprint?: boolean;
  copyLabel?: string;
  upiQrDataUrl?: string;
  containerId?: string;
}

export const PrintableDocumentView: React.FC<PrintableDocumentViewProps> = ({
  bill,
  settings,
  format,
  isReprint = false,
  copyLabel,
  upiQrDataUrl,
  containerId = 'printable-document-content'
}) => {
  const totalOutstanding = bill.newBalancePaise ?? (bill.previousDuePaise + bill.balancePaise);
  const formattedDate = new Date(bill.date).toLocaleDateString('en-IN');
  const formattedTime = new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ----------------------------------------------------
  // 58MM Thermal Narrow Slip (Compact 32 Columns)
  // ----------------------------------------------------
  if (format === '58MM') {
    return (
      <div
        id={containerId}
        className="w-[280px] bg-white text-black p-3 font-mono text-[10px] leading-tight select-text shadow-md mx-auto"
      >
        {isReprint && (
          <div className="border border-dashed border-red-600 text-red-600 font-bold text-center py-0.5 mb-1.5 text-[9px] uppercase tracking-wider">
            *** DUPLICATE / REPRINT ***
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b border-dashed border-black pb-2 mb-2">
          {settings.showBusinessName && (
            <div className="text-xs font-black uppercase tracking-wider">{settings.businessName}</div>
          )}
          {settings.showSubtitle && (
            <div className="text-[8px] text-gray-700">{settings.subtitle}</div>
          )}
          {settings.showAddress && (
            <div className="text-[8px]">{settings.address}</div>
          )}
          {settings.showPhone && (
            <div className="text-[8px]">PH: {settings.phone}</div>
          )}
          {settings.showGSTIN && (
            <div className="text-[8px] font-bold">GSTIN: {settings.gstin}</div>
          )}
          <div className="text-[9px] font-bold border border-black inline-block px-1 mt-1">
            {copyLabel || bill.documentType.replace('_', ' ')}
          </div>
        </div>

        {/* Bill Metadata */}
        <div className="border-b border-dashed border-black pb-1.5 mb-1.5 space-y-0.5 text-[9px]">
          <div className="flex justify-between">
            <span>NO: <b>{bill.billNumber}</b></span>
            <span>{formattedDate} {formattedTime}</span>
          </div>
          <div>CUST: <b>{bill.customerName}</b></div>
          {settings.showCustomerMobile && bill.customerMobile && (
            <div>MOB: {bill.customerMobile}</div>
          )}
          {settings.showTransportInfo && bill.notes && (
            <div className="truncate">TR: {bill.notes}</div>
          )}
        </div>

        {/* Items Table */}
        <div className="border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="flex justify-between font-bold border-b border-black pb-0.5 mb-1 text-[9px]">
            <span>ITEM</span>
            <span className="w-8 text-center">QTY</span>
            <span className="w-10 text-right">RATE</span>
            <span className="w-12 text-right">TOTAL</span>
          </div>
          {bill.items.map((it, idx) => (
            <div key={idx} className="flex justify-between py-0.5 text-[9px]">
              <span className="truncate pr-1 max-w-[120px]">{it.details}</span>
              <span className="w-8 text-center">{it.quantity}</span>
              <span className="w-10 text-right">₹{paiseToRupees(it.ratePaise)}</span>
              <span className="w-12 text-right font-bold">₹{paiseToRupees(it.totalPaise)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5 text-[9px]">
          <div className="flex justify-between">
            <span>TOTAL QTY:</span>
            <b>{bill.totalQuantity} PCS</b>
          </div>
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>₹{paiseToRupees(bill.subtotalPaise).toFixed(2)}</span>
          </div>
          {bill.discountPaise > 0 && (
            <div className="flex justify-between">
              <span>DISCOUNT:</span>
              <span>-₹{paiseToRupees(bill.discountPaise).toFixed(2)}</span>
            </div>
          )}
          {bill.gstPaise > 0 && (
            <div className="flex justify-between">
              <span>GST:</span>
              <span>+₹{paiseToRupees(bill.gstPaise).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-[11px] border-t border-black pt-1">
            <span>GRAND TOTAL:</span>
            <span>₹{paiseToRupees(bill.grandTotalPaise).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>PAID ({bill.paymentMethod}):</span>
            <span>₹{paiseToRupees(bill.paidPaise).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>BILL DUE:</span>
            <span>₹{paiseToRupees(bill.balancePaise).toFixed(2)}</span>
          </div>
          {bill.previousDuePaise > 0 && (
            <div className="flex justify-between">
              <span>PREV DUE:</span>
              <span>₹{paiseToRupees(bill.previousDuePaise).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-[10px] border-t border-dashed border-black pt-0.5">
            <span>TOTAL DUE:</span>
            <span>₹{paiseToRupees(totalOutstanding).toFixed(2)}</span>
          </div>
        </div>

        {/* UPI QR Code */}
        {settings.enableUpiQrCode && upiQrDataUrl && (
          <div className="text-center border-b border-dashed border-black pb-2 mb-2">
            <div className="text-[8px] font-bold">SCAN TO PAY VIA UPI</div>
            <img src={upiQrDataUrl} alt="UPI QR" className="w-24 h-24 mx-auto my-0.5 border border-black p-0.5" />
            <div className="text-[8px] font-mono">{settings.upiVpa}</div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[8px] text-gray-700 space-y-0.5">
          <div>{settings.footerTerms1}</div>
          <div>THANK YOU! VISIT AGAIN</div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 80MM Thermal Slip (Standard 48 Columns)
  // ----------------------------------------------------
  if (format === '80MM') {
    return (
      <div
        id={containerId}
        className="w-[360px] bg-white text-black p-5 font-mono text-xs leading-normal select-text shadow-lg mx-auto"
      >
        {isReprint && (
          <div className="border-2 border-dashed border-red-600 text-red-600 font-black text-center py-1 mb-2 text-xs uppercase tracking-widest">
            *** DUPLICATE / REPRINT INVOICE ***
          </div>
        )}

        {/* Store Header */}
        <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
          {settings.showBusinessName && (
            <h1 className="text-base font-black tracking-wider uppercase leading-tight">
              {settings.businessName}
            </h1>
          )}
          {settings.showSubtitle && (
            <p className="text-[10px] font-bold text-gray-800 uppercase">{settings.subtitle}</p>
          )}
          {settings.showAddress && (
            <p className="text-[10px] text-gray-700">{settings.address}</p>
          )}
          <div className="text-[10px] text-gray-700 flex justify-center gap-2">
            {settings.showPhone && <span>PH: {settings.phone}</span>}
            {settings.showState && <span>STATE: {settings.stateName} ({settings.stateCode})</span>}
          </div>
          {settings.showGSTIN && (
            <p className="text-[10px] font-bold">GSTIN: {settings.gstin}</p>
          )}
          <div className="mt-1.5">
            <span className="text-[11px] font-black border border-black px-2 py-0.5 uppercase tracking-wide">
              {copyLabel || bill.documentType.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Customer & Bill Details */}
        <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span>BILL NO: <b className="font-mono text-xs">{bill.billNumber}</b></span>
            <span>{formattedDate} {formattedTime}</span>
          </div>
          <div className="flex justify-between">
            <span>CUSTOMER:</span>
            <span className="font-bold text-right">{bill.customerName}</span>
          </div>
          {settings.showCustomerMobile && bill.customerMobile && (
            <div className="flex justify-between text-gray-700">
              <span>MOBILE:</span>
              <span>{bill.customerMobile}</span>
            </div>
          )}
          {settings.showTransportInfo && bill.notes && (
            <div className="flex justify-between text-gray-700">
              <span>TRANSPORT / MARKA:</span>
              <span className="font-semibold text-right">{bill.notes}</span>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
          <div className="flex justify-between font-bold text-[10px] border-b border-gray-300 pb-1 mb-1">
            <span className="flex-1">ITEM</span>
            <span className="w-10 text-center">QTY</span>
            <span className="w-14 text-right">RATE</span>
            <span className="w-16 text-right">TOTAL</span>
          </div>
          {bill.items.map((it, idx) => (
            <div key={idx} className="flex justify-between py-0.5 text-[11px]">
              <div className="flex-1 pr-1 truncate font-medium">
                {idx + 1}. {it.details}
              </div>
              <span className="w-10 text-center font-bold">{it.quantity}</span>
              <span className="w-14 text-right">₹{paiseToRupees(it.ratePaise)}</span>
              <span className="w-16 text-right font-bold">₹{paiseToRupees(it.totalPaise)}</span>
            </div>
          ))}
        </div>

        {/* Financial Breakdown */}
        <div className="text-[11px] space-y-1 border-b border-dashed border-gray-400 pb-2 mb-2">
          <div className="flex justify-between">
            <span>TOTAL QUANTITY:</span>
            <span className="font-bold">{bill.totalQuantity} PCS</span>
          </div>
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>₹{paiseToRupees(bill.subtotalPaise).toFixed(2)}</span>
          </div>
          {bill.discountPaise > 0 && (
            <div className="flex justify-between text-emerald-800">
              <span>DISCOUNT:</span>
              <span>-₹{paiseToRupees(bill.discountPaise).toFixed(2)}</span>
            </div>
          )}
          {bill.gstPaise > 0 && (
            <div className="flex justify-between">
              <span>GST:</span>
              <span>+₹{paiseToRupees(bill.gstPaise).toFixed(2)}</span>
            </div>
          )}
          {bill.roundOffPaise !== 0 && (
            <div className="flex justify-between text-gray-600 text-[10px]">
              <span>ROUND OFF:</span>
              <span>{bill.roundOffPaise > 0 ? '+' : ''}₹{paiseToRupees(bill.roundOffPaise).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm border-t border-black pt-1">
            <span>GRAND TOTAL:</span>
            <span>₹{paiseToRupees(bill.grandTotalPaise).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>PAID ({bill.paymentMethod}):</span>
            <span>₹{paiseToRupees(bill.paidPaise).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>BILL BALANCE:</span>
            <span>₹{paiseToRupees(bill.balancePaise).toFixed(2)}</span>
          </div>
          {bill.previousDuePaise > 0 && (
            <div className="flex justify-between text-amber-900">
              <span>PREVIOUS DUE:</span>
              <span>₹{paiseToRupees(bill.previousDuePaise).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-xs border-t border-dashed border-gray-400 pt-1">
            <span>TOTAL OUTSTANDING:</span>
            <span>₹{paiseToRupees(totalOutstanding).toFixed(2)}</span>
          </div>
        </div>

        {/* Dynamic UPI Payment QR Code */}
        {settings.enableUpiQrCode && upiQrDataUrl && (
          <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-2">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1">
              SCAN & PAY WITH ANY UPI APP
            </div>
            <img
              src={upiQrDataUrl}
              alt="UPI QR Code"
              className="w-28 h-28 mx-auto border-2 border-black p-1 bg-white"
            />
            <div className="text-[9px] font-mono mt-1 text-gray-700">UPI ID: {settings.upiVpa}</div>
            <div className="text-[8px] text-gray-500">GPay • PhonePe • Paytm • BHIM • Cred</div>
          </div>
        )}

        {/* Footer & Terms */}
        <div className="text-center text-[9px] text-gray-700 space-y-0.5 pt-1">
          <div>{settings.footerTerms1}</div>
          <div>{settings.footerTerms2}</div>
          <div className="font-bold pt-1">THANK YOU FOR YOUR WHOLESALE ORDER!</div>
          <div className="text-[8px] font-mono text-gray-400 pt-1">
            ORIGINAL MODI BAGS • ROOM DB LOCAL-FIRST
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // A5 Wholesale Invoice Half-Sheet (Commercial Trading Challan)
  // ----------------------------------------------------
  if (format === 'A5') {
    return (
      <div
        id={containerId}
        className="w-[580px] bg-white text-black p-6 font-sans text-xs select-text shadow-xl border border-gray-300 mx-auto"
      >
        {isReprint && (
          <div className="bg-red-50 border border-red-400 text-red-700 font-bold text-center py-1 mb-3 text-xs tracking-wider uppercase">
            *** DUPLICATE COPY / REPRINT ***
          </div>
        )}

        {/* Header Block */}
        <div className="border border-black p-3 mb-2 flex justify-between items-start">
          <div className="space-y-0.5">
            <h1 className="text-lg font-black tracking-wide text-black">{settings.businessName}</h1>
            <p className="text-[11px] font-semibold text-gray-800">{settings.subtitle}</p>
            <p className="text-[10px] text-gray-700">{settings.address}</p>
            <p className="text-[10px] text-gray-700">
              Phone: <b className="text-black">{settings.phone}</b> | State: <b>{settings.stateName} ({settings.stateCode})</b>
            </p>
            <p className="text-[10px] font-mono font-bold">GSTIN: {settings.gstin}</p>
          </div>
          <div className="text-right">
            <div className="border border-black px-3 py-1 font-black text-xs uppercase bg-gray-100 inline-block mb-1">
              {copyLabel || 'WHOLESALE CHALLAN / INVOICE'}
            </div>
            <div className="text-[11px]">Bill No: <b className="font-mono font-bold">{bill.billNumber}</b></div>
            <div className="text-[11px]">Date: <b>{formattedDate}</b></div>
          </div>
        </div>

        {/* Customer & Transport Strip */}
        <div className="border border-black p-2.5 mb-2 grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <div className="text-[9px] uppercase font-bold text-gray-500">Billed To (Wholesale Party)</div>
            <div className="text-sm font-bold text-black mt-0.5">{bill.customerName}</div>
            {bill.customerMobile && <div>Mobile: {bill.customerMobile}</div>}
          </div>
          <div className="border-l border-gray-300 pl-3">
            <div className="text-[9px] uppercase font-bold text-gray-500">Dispatch / Transport Info</div>
            <div className="text-xs font-semibold text-black mt-0.5">{bill.notes || 'Direct Counter Delivery / Kolkata'}</div>
            <div className="text-[10px] text-gray-600">Payment Mode: <b>{bill.paymentMethod}</b></div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse border border-black mb-2 text-[11px]">
          <thead>
            <tr className="bg-gray-100 font-bold border-b border-black">
              <th className="border-r border-black p-1 text-center w-8">#</th>
              <th className="border-r border-black p-1 text-left">Description of Bags</th>
              <th className="border-r border-black p-1 text-center w-14">HSN</th>
              <th className="border-r border-black p-1 text-center w-12">Qty</th>
              <th className="border-r border-black p-1 text-right w-16">Rate (₹)</th>
              <th className="p-1 text-right w-20">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="border-r border-black p-1 text-center font-mono">{idx + 1}</td>
                <td className="border-r border-black p-1 font-semibold">{it.details}</td>
                <td className="border-r border-black p-1 text-center font-mono text-[10px]">4202</td>
                <td className="border-r border-black p-1 text-center font-bold">{it.quantity}</td>
                <td className="border-r border-black p-1 text-right font-mono">₹{paiseToRupees(it.ratePaise)}</td>
                <td className="p-1 text-right font-bold font-mono">₹{paiseToRupees(it.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Lower Split: Financials & Signatures */}
        <div className="grid grid-cols-12 border border-black mb-2">
          {/* Left 6 cols: UPI QR & Banking */}
          <div className="col-span-6 p-2 border-r border-black space-y-1 text-[10px]">
            {settings.enableUpiQrCode && upiQrDataUrl ? (
              <div className="flex items-center gap-2">
                <img src={upiQrDataUrl} alt="UPI QR" className="w-20 h-20 border border-black p-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs">Instant UPI Payment</div>
                  <div className="font-mono text-[9px]">{settings.upiVpa}</div>
                  <div className="text-[8px] text-gray-600">Scan via PhonePe, GPay, Paytm</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-[9px] italic">
                Bank Details: Indian Bank, Kolkata Branch • A/C No: 5041982348 • IFSC: IDIB000K012
              </div>
            )}
            <div className="text-[9px] text-gray-700 pt-1 border-t border-gray-200">
              {settings.footerTerms1}
            </div>
          </div>

          {/* Right 6 cols: Ledger Breakdown */}
          <div className="col-span-6 p-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Total Quantity:</span>
              <b>{bill.totalQuantity} PCS</b>
            </div>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono">₹{paiseToRupees(bill.subtotalPaise).toFixed(2)}</span>
            </div>
            {bill.discountPaise > 0 && (
              <div className="flex justify-between text-emerald-800">
                <span>Discount:</span>
                <span className="font-mono">-₹{paiseToRupees(bill.discountPaise).toFixed(2)}</span>
              </div>
            )}
            {bill.gstPaise > 0 && (
              <div className="flex justify-between">
                <span>GST:</span>
                <span className="font-mono">+₹{paiseToRupees(bill.gstPaise).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-xs border-t border-black pt-1">
              <span>Grand Total:</span>
              <span className="font-mono">₹{paiseToRupees(bill.grandTotalPaise).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid ({bill.paymentMethod}):</span>
              <span className="font-mono">₹{paiseToRupees(bill.paidPaise).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Bill Due:</span>
              <span className="font-mono">₹{paiseToRupees(bill.balancePaise).toFixed(2)}</span>
            </div>
            {bill.previousDuePaise > 0 && (
              <div className="flex justify-between text-amber-900">
                <span>Previous Due:</span>
                <span className="font-mono">₹{paiseToRupees(bill.previousDuePaise).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-xs border-t border-black pt-0.5">
              <span>Total Outstanding:</span>
              <span className="font-mono">₹{paiseToRupees(totalOutstanding).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Signature Box */}
        <div className="flex justify-between items-end pt-3 text-[10px]">
          <div className="text-center w-40 border-t border-black pt-1">
            Customer's Signature
          </div>
          <div className="text-center w-48 border-t border-black pt-1 font-bold">
            For {settings.businessName}<br />
            <span className="text-[9px] font-normal text-gray-600">Authorized Signatory</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // A4 Full Commercial Tax Invoice / Bill of Supply
  // ----------------------------------------------------
  return (
    <div
      id={containerId}
      className="w-[780px] bg-white text-black p-8 font-sans text-xs select-text shadow-2xl border border-gray-400 mx-auto"
    >
      {isReprint && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 font-black text-center py-1.5 mb-4 text-sm tracking-widest uppercase">
          *** DUPLICATE COPY / REPRINT TAX INVOICE ***
        </div>
      )}

      {/* Commercial Header */}
      <div className="border border-black mb-3">
        <div className="p-3 border-b border-black flex justify-between items-center bg-gray-50">
          <div>
            <h1 className="text-xl font-black tracking-wide text-black uppercase">
              {settings.businessName}
            </h1>
            <p className="text-xs font-bold text-gray-800">{settings.subtitle}</p>
          </div>
          <div className="text-right">
            <span className="border-2 border-black px-3 py-1 font-black text-sm uppercase bg-white">
              {copyLabel || 'TAX INVOICE / BILL OF SUPPLY'}
            </span>
            <div className="text-[10px] text-gray-600 mt-1">Rule 46 of CGST Rules, 2017</div>
          </div>
        </div>

        {/* 2-Column Details Box */}
        <div className="grid grid-cols-2 divide-x divide-black text-[11px]">
          {/* Supplier details */}
          <div className="p-3 space-y-1">
            <div className="text-[9px] uppercase font-bold text-gray-500">Supplier Details</div>
            <div className="font-bold text-xs">{settings.businessName}</div>
            <div>{settings.address}</div>
            <div>Phone: <b>{settings.phone}</b></div>
            <div>State: <b>{settings.stateName}</b> (Code: <b>{settings.stateCode}</b>)</div>
            <div className="font-mono font-bold">GSTIN: {settings.gstin}</div>
          </div>

          {/* Invoice & Buyer details */}
          <div className="p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-[9px] uppercase font-bold text-gray-500">Invoice No:</span>
              <span className="font-mono font-bold text-xs">{bill.billNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] uppercase font-bold text-gray-500">Invoice Date:</span>
              <span className="font-semibold">{formattedDate}</span>
            </div>
            <div className="pt-1 border-t border-gray-200">
              <div className="text-[9px] uppercase font-bold text-gray-500">Details of Receiver / Billed to:</div>
              <div className="font-bold text-sm text-black">{bill.customerName}</div>
              {bill.customerMobile && <div>Mobile: {bill.customerMobile}</div>}
              {bill.notes && <div>Transport / Marka: <b>{bill.notes}</b></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <table className="w-full border-collapse border border-black mb-3 text-[11px]">
        <thead>
          <tr className="bg-gray-100 font-bold border-b border-black">
            <th className="border-r border-black p-1.5 text-center w-10">S.No</th>
            <th className="border-r border-black p-1.5 text-left">Description of Goods / Bags</th>
            <th className="border-r border-black p-1.5 text-center w-16">HSN/SAC</th>
            <th className="border-r border-black p-1.5 text-center w-14">Qty</th>
            <th className="border-r border-black p-1.5 text-center w-12">Unit</th>
            <th className="border-r border-black p-1.5 text-right w-20">Rate (₹)</th>
            <th className="p-1.5 text-right w-24">Total Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((it, idx) => (
            <tr key={idx} className="border-b border-gray-200">
              <td className="border-r border-black p-1.5 text-center font-mono">{idx + 1}</td>
              <td className="border-r border-black p-1.5 font-bold">{it.details}</td>
              <td className="border-r border-black p-1.5 text-center font-mono">4202</td>
              <td className="border-r border-black p-1.5 text-center font-black">{it.quantity}</td>
              <td className="border-r border-black p-1.5 text-center text-gray-600">PCS</td>
              <td className="border-r border-black p-1.5 text-right font-mono">₹{paiseToRupees(it.ratePaise).toFixed(2)}</td>
              <td className="p-1.5 text-right font-black font-mono">₹{paiseToRupees(it.totalPaise).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Summary Grid */}
      <div className="grid grid-cols-12 border border-black mb-3">
        {/* Left 7 cols: Bank details, UPI QR, Terms */}
        <div className="col-span-7 p-3 border-r border-black space-y-2">
          <div className="flex items-center gap-3">
            {settings.enableUpiQrCode && upiQrDataUrl && (
              <img src={upiQrDataUrl} alt="UPI QR" className="w-24 h-24 border border-black p-0.5 bg-white" />
            )}
            <div className="space-y-0.5 text-[10px]">
              <div className="font-bold text-xs uppercase">Bank & UPI Remittance</div>
              <div>Bank: <b>Indian Bank</b> • Branch: <b>Kolkata Main</b></div>
              <div>A/C Name: <b>ORIGINAL MODI BAGS</b></div>
              <div>A/C No: <b className="font-mono">5041982348</b></div>
              <div>IFSC Code: <b className="font-mono">IDIB000K012</b></div>
              <div className="font-mono text-emerald-800 font-bold">UPI ID: {settings.upiVpa}</div>
            </div>
          </div>

          <div className="text-[10px] text-gray-700 pt-2 border-t border-gray-200 space-y-0.5">
            <div className="font-bold uppercase text-[9px]">Terms & Conditions:</div>
            <div>1. {settings.footerTerms1}</div>
            <div>2. {settings.footerTerms2}</div>
            <div>3. Interest @ 18% per annum will be charged if bill is unpaid after credit period.</div>
          </div>
        </div>

        {/* Right 5 cols: Financial Statement */}
        <div className="col-span-5 p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Total Units:</span>
            <b>{bill.totalQuantity} PCS</b>
          </div>
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-mono font-semibold">₹{paiseToRupees(bill.subtotalPaise).toFixed(2)}</span>
          </div>
          {bill.discountPaise > 0 && (
            <div className="flex justify-between text-emerald-800">
              <span>Wholesale Discount:</span>
              <span className="font-mono font-bold">-₹{paiseToRupees(bill.discountPaise).toFixed(2)}</span>
            </div>
          )}
          {bill.gstPaise > 0 && (
            <div className="flex justify-between">
              <span>GST:</span>
              <span className="font-mono font-bold">+₹{paiseToRupees(bill.gstPaise).toFixed(2)}</span>
            </div>
          )}
          {bill.roundOffPaise !== 0 && (
            <div className="flex justify-between text-gray-600 text-[10px]">
              <span>Round Off:</span>
              <span className="font-mono">{bill.roundOffPaise > 0 ? '+' : ''}₹{paiseToRupees(bill.roundOffPaise).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm border-t border-black pt-1 text-black">
            <span>Grand Total:</span>
            <span className="font-mono">₹{paiseToRupees(bill.grandTotalPaise).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid ({bill.paymentMethod}):</span>
            <span className="font-mono">₹{paiseToRupees(bill.paidPaise).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Current Balance:</span>
            <span className="font-mono">₹{paiseToRupees(bill.balancePaise).toFixed(2)}</span>
          </div>
          {bill.previousDuePaise > 0 && (
            <div className="flex justify-between text-amber-900">
              <span>Previous Outstanding:</span>
              <span className="font-mono">₹{paiseToRupees(bill.previousDuePaise).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm border-t-2 border-black pt-1">
            <span>Net Total Outstanding:</span>
            <span className="font-mono text-orange-950">₹{paiseToRupees(totalOutstanding).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Authorized Signature Block */}
      <div className="grid grid-cols-2 pt-6 text-[11px]">
        <div>
          <div className="h-12"></div>
          <div className="border-t border-black w-48 text-center pt-1">
            Receiver's Signature
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="font-bold text-xs uppercase mb-12">For {settings.businessName}</div>
          <div className="border-t border-black w-56 text-center pt-1">
            Authorized Signatory / Partner
          </div>
        </div>
      </div>
    </div>
  );
};
