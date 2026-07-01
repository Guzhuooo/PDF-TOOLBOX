import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import { LicenseProvider } from "@/contexts/LicenseContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

// PDF工具箱
import PdfMergePage from "@/pages/Pdf/MergePage/MergePage";
import PdfSplitPage from "@/pages/Pdf/SplitPage/SplitPage";
import PdfRotatePage from "@/pages/Pdf/RotatePage/RotatePage";
import PdfEncryptPage from "@/pages/Pdf/EncryptPage/EncryptPage";
import PdfDecryptPage from "@/pages/Pdf/DecryptPage/DecryptPage";

// 图片工具箱
import ImageCompressPage from "@/pages/Image/CompressPage/CompressPage";
import ImageConvertPage from "@/pages/Image/ConvertPage/ConvertPage";
import ImageResizePage from "@/pages/Image/ResizePage/ResizePage";
import ImageWatermarkPage from "@/pages/Image/WatermarkPage/WatermarkPage";

// 二维码工具箱
import QrGeneratePage from "@/pages/Qr/GeneratePage/GeneratePage";
import QrDecodePage from "@/pages/Qr/DecodePage/DecodePage";
import QrBeautifyPage from "@/pages/Qr/BeautifyPage/BeautifyPage";
import QrBatchPage from "@/pages/Qr/BatchPage/BatchPage";

// 文本工具箱
import TextDiffPage from "@/pages/Text/DiffPage/DiffPage";
import TextDedupPage from "@/pages/Text/DedupPage/DedupPage";
import TextStatsPage from "@/pages/Text/StatsPage/StatsPage";

// 计算工具箱
import UnitConverterPage from "@/pages/Calc/UnitConverterPage/UnitConverterPage";
import CalculatorPage from "@/pages/Calc/CalculatorPage/CalculatorPage";
import MortgagePage from "@/pages/Calc/MortgagePage/MortgagePage";

export default function App() {
  return (
    <ThemeProvider>
      <LicenseProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/pdf/merge" replace />} />

            {/* PDF工具箱 */}
            <Route path="pdf/merge" element={<PdfMergePage />} />
            <Route path="pdf/split" element={<PdfSplitPage />} />
            <Route path="pdf/rotate" element={<PdfRotatePage />} />
            <Route path="pdf/encrypt" element={<PdfEncryptPage />} />
            <Route path="pdf/decrypt" element={<PdfDecryptPage />} />

            {/* 图片工具箱 */}
            <Route path="image/compress" element={<ImageCompressPage />} />
            <Route path="image/convert" element={<ImageConvertPage />} />
            <Route path="image/resize" element={<ImageResizePage />} />
            <Route path="image/watermark" element={<ImageWatermarkPage />} />

            {/* 二维码工具箱 */}
            <Route path="qr/generate" element={<QrGeneratePage />} />
            <Route path="qr/decode" element={<QrDecodePage />} />
            <Route path="qr/beautify" element={<QrBeautifyPage />} />
            <Route path="qr/batch" element={<QrBatchPage />} />

            {/* 文本工具箱 */}
            <Route path="text/diff" element={<TextDiffPage />} />
            <Route path="text/dedup" element={<TextDedupPage />} />
            <Route path="text/stats" element={<TextStatsPage />} />

            {/* 计算工具箱 */}
            <Route path="calc/converter" element={<UnitConverterPage />} />
            <Route path="calc/calculator" element={<CalculatorPage />} />
            <Route path="calc/mortgage" element={<MortgagePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </LicenseProvider>
    </ThemeProvider>
  );
}
