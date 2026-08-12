"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Download, QrCode, Share2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface VisitorQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  territoryNumber: string | number;
  territoryName: string;
  congregationId: string;
  territoryId: string;
}

export default function VisitorQrModal({
  isOpen,
  onClose,
  territoryNumber,
  territoryName,
  congregationId,
  territoryId,
}: VisitorQrModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const visitorUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/visitante/${congregationId}/${territoryId}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(visitorUrl);
    setCopied(true);
    toast({ title: "Link copiado!", description: "Link de acesso para visitante copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Território ${territoryNumber} - ${territoryName}`,
          text: `Acesse o Território ${territoryNumber} como visitante:`,
          url: visitorUrl,
        });
      } catch (err) {
        // Compartilhamento cancelado pelo usuário
      }
    } else {
      handleCopy();
    }
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById("visitor-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-territorio-${territoryNumber}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      toast({ title: "Download iniciado", description: "QR Code salvo como imagem PNG." });
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <QrCode className="text-primary h-6 w-6" />
            QR Code para Visitantes
          </DialogTitle>
          <DialogDescription>
            Território {territoryNumber} - {territoryName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-md border border-border">
            <QRCodeSVG
              id="visitor-qr-svg"
              value={visitorUrl}
              size={220}
              level={"H"}
              includeMargin={true}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Visitantes podem escanear este QR Code para acessar o território informando apenas o nome, sem precisar de cadastro, para marcar as casas trabalhadas.
          </p>

          <div className="w-full flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="flex-1 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar Link"}
            </Button>

            <Button
              onClick={handleShare}
              className="flex-1 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar Link
            </Button>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={handleDownloadQr} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Baixar Imagem
          </Button>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
