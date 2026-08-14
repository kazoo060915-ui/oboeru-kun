import { NextRequest, NextResponse } from 'next/server';
import { extractTermsFromText, extractTermsFromImage, ExtractedTerm } from '@/lib/anthropic';
import { requireAuth } from '@/lib/auth';

// 対応ファイル形式の定義
const TEXT_EXTENSIONS = ['.txt', '.md', '.vtt', '.srt', '.csv', '.json', '.html', '.htm'];
const PDF_EXTENSIONS = ['.pdf'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

const ALL_SUPPORTED = [...TEXT_EXTENSIONS, ...PDF_EXTENSIONS, ...IMAGE_EXTENSIONS];

// MIMEタイプ → Claude Vision API の mediaType マッピング
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
const IMAGE_MEDIA_TYPE_MAP: Record<string, ImageMediaType> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません。' }, { status: 400 });
    }

    const fileName = file.name;
    const ext = ('.' + fileName.split('.').pop()?.toLowerCase()) as string;

    // 拡張子チェック
    if (!ALL_SUPPORTED.includes(ext)) {
      return NextResponse.json(
        {
          error: `${ext} 形式は非対応やで。対応しているのは：テキスト系（${TEXT_EXTENSIONS.join(', ')}）、PDF（.pdf）、画像（${IMAGE_EXTENSIONS.join(', ')}）やで！`,
        },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（20MB上限 ※画像・PDF対応で引き上げ）
    const MAX_SIZE_MB = 20;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `ファイルが大きすぎます（${MAX_SIZE_MB}MB以下にしてください）。` },
        { status: 400 }
      );
    }

    let terms: ExtractedTerm[] = [];

    // ─── PDF ───────────────────────────────────
    if (PDF_EXTENSIONS.includes(ext)) {
      try {
        // pdf-parse は CommonJS モジュールのため require で呼ぶ
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfData = await pdfParse(buffer);
        const text = pdfData.text;

        if (!text?.trim()) {
          return NextResponse.json({
            terms: [],
            message: 'このPDFからテキストを抽出できへんかったわ。スキャンしただけの画像PDFは非対応やで。代わりにスクリーンショット（.png/.jpg）で試してみて！',
          });
        }

        terms = await extractTermsFromText(text, fileName);
      } catch (pdfError: any) {
        console.error('PDF parse error:', pdfError);
        return NextResponse.json(
          { error: 'PDFの読み込みに失敗しました。破損していないか確認してください。' },
          { status: 500 }
        );
      }
    }

    // ─── 画像（PNG / JPG / WEBP / GIF） ────────
    else if (IMAGE_EXTENSIONS.includes(ext)) {
      const mediaType = IMAGE_MEDIA_TYPE_MAP[ext];
      if (!mediaType) {
        return NextResponse.json({ error: '画像形式の判定に失敗しました。' }, { status: 400 });
      }

      // 画像サイズ制限：Claude Vision API は 5MB 以下推奨
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: '画像ファイルは5MB以下にしてください（Visionモデルの制限）。' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      terms = await extractTermsFromImage(base64, mediaType, fileName);
    }

    // ─── テキスト系 ─────────────────────────────
    else {
      const text = await file.text();
      if (!text.trim()) {
        return NextResponse.json(
          { error: 'ファイルの中身が空やで。内容があるファイルを選んでな。' },
          { status: 400 }
        );
      }
      terms = await extractTermsFromText(text, fileName);
    }

    // 結果返却
    if (!terms || terms.length === 0) {
      return NextResponse.json({
        terms: [],
        message: 'このファイルから復習すべき用語は見つからへんかったわ。別のファイルを試してみて。',
      });
    }

    const fileTypeLabel = PDF_EXTENSIONS.includes(ext)
      ? 'PDF'
      : IMAGE_EXTENSIONS.includes(ext)
      ? '画像'
      : 'テキスト';

    return NextResponse.json({
      terms,
      source: fileName,
      message: `${fileTypeLabel}ファイル「${fileName}」から ${terms.length} 件の用語を抽出したで！`,
    });
  } catch (error: any) {
    console.error('Extract API Error:', error);
    return NextResponse.json(
      { error: error?.message || '用語の抽出に失敗しました。もう一度試してみてください。' },
      { status: 500 }
    );
  }
}
