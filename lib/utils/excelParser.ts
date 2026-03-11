/**
 * Client-side CSV/Excel parser (no external library required)
 * Supports: .csv, .txt (tab or comma delimited)
 * For .xlsx: user should "Save As CSV" from Excel, or we use CDN xlsx
 */

export interface ParsedRow {
  doc_no: string
  item_title: string
  item_description?: string
  required_flag: boolean
  allow_multiple_files: boolean
  sort_order: number
  pbc_category?: string
}

/** Parse CSV text into rows */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Detect delimiter
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : ','

  // Parse headers
  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))

  return lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })
}

/** Normalize column names (supports Korean and English headers) */
function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key]
  }
  return ''
}

/** Convert parsed rows to PBC item format */
function rowsToPbcItems(rows: Record<string, string>[]): ParsedRow[] {
  return rows
    .filter(row => {
      const code = getField(row, '항목코드', 'doc_no', '코드', 'Doc No', 'DocNo', 'CODE')
      const title = getField(row, '항목명', 'item_title', '제목', 'Title', 'TITLE', '명칭')
      return code || title
    })
    .map((row, idx) => {
      const doc_no = getField(row, '항목코드', 'doc_no', '코드', 'Doc No', 'DocNo', 'CODE').trim()
        || `ITEM-${String(idx + 1).padStart(3, '0')}`
      const item_title = getField(row, '항목명', 'item_title', '제목', 'Title', 'TITLE', '명칭').trim()
      const item_description = getField(row, '설명', 'item_description', 'description', 'Description', 'DESC').trim() || undefined
      const required_str = getField(row, '필수', 'required', 'Required', 'REQUIRED').toUpperCase()
      const required_flag = required_str !== 'N' && required_str !== 'FALSE' && required_str !== '0'
      const multi_str = getField(row, '복수파일', 'multiple_files', 'allow_multiple_files').toUpperCase()
      const allow_multiple_files = multi_str === 'Y' || multi_str === 'TRUE' || multi_str === '1'
      const pbc_category = getField(row, '카테고리', 'category', 'pbc_category', 'Category').trim() || undefined

      return {
        doc_no,
        item_title,
        item_description,
        required_flag,
        allow_multiple_files,
        sort_order: idx + 1,
        pbc_category,
      }
    })
}

/** Parse a File object into PBC items */
export async function parseFileToItems(file: File): Promise<ParsedRow[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    // Read as text
    const text = await file.text()
    const rows = parseCsv(text)
    return rowsToPbcItems(rows)
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    // Try to load xlsx from CDN dynamically
    try {
      // @ts-expect-error dynamic CDN load
      if (typeof window !== 'undefined' && !window.XLSX) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('XLSX library load failed'))
          document.head.appendChild(script)
        })
      }
      // @ts-expect-error global XLSX from CDN
      const XLSX = window.XLSX
      if (XLSX) {
        const buffer = await file.arrayBuffer()
        const data = new Uint8Array(buffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        return rowsToPbcItems(rows)
      }
    } catch (e) {
      console.warn('XLSX CDN load failed, trying CSV fallback:', e)
    }

    throw new Error(
      '.xlsx 파일은 엑셀에서 "다른 이름으로 저장 → CSV" 형식으로 저장 후 업로드해주세요.\n또는 CSV/TSV 파일을 직접 업로드하세요.'
    )
  }

  throw new Error('지원하지 않는 파일 형식입니다. CSV 또는 XLSX 파일을 업로드해주세요.')
}

/** Generate sample CSV content */
export function generateSampleCsv(): string {
  const headers = '항목코드,항목명,설명,필수,복수파일,카테고리'
  const rows = [
    'GEN-001,이사회 및 주주총회 의사록,감사기간 중 이사회 의사록 전체,Y,Y,GENERAL',
    'CASH-001,은행 계좌 목록,모든 계좌 목록 (은행명/계좌번호/잔액),Y,N,CASH',
    'CASH-002,은행 잔액 증명서,기준일 기준 각 은행 잔액 증명서,Y,Y,CASH',
    'CASH-003,월별 은행 거래명세서,감사기간 전체 월별 거래명세서,Y,Y,CASH',
    'AR-001,매출채권 연령 분석표,거래처별 경과기간별 매출채권 명세,Y,N,AR',
    'AR-002,매출채권 잔액 확인서,주요 거래처로부터의 잔액 확인서,N,Y,AR',
    'INV-001,재고자산 실사 명세서,실사 시점 재고 수량 및 금액 명세,Y,Y,INVENTORY',
    'PPE-001,유형자산 명세서,유형자산 대장 (취득가/누계상각/장부가),Y,N,PPE',
    'AP-001,매입채무 연령 분석표,거래처별 경과기간별 매입채무 명세,Y,N,AP',
    'TAX-001,법인세 신고서,감사 사업연도 법인세 신고서,Y,Y,TAX',
    'EQ-001,자본 변동표,자본금/자본잉여금/이익잉여금 변동 내역,Y,N,EQUITY',
    'OTH-003,경영자 확인서,경영진의 재무제표 적정성 확인서,Y,N,OTHER',
  ]
  return [headers, ...rows].join('\n')
}

/** Download sample CSV */
export function downloadSampleCsv(filename: string = 'pbc_template_sample.csv') {
  const content = generateSampleCsv()
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Export items to CSV */
export function exportItemsToCsv(items: {
  doc_no: string
  item_title: string
  item_description?: string | null
  required_flag?: boolean
  allow_multiple_files?: boolean
  item_status?: string
}[], filename: string) {
  const headers = '항목코드,항목명,설명,필수,복수파일,상태'
  const rows = items.map(item =>
    [
      item.doc_no,
      `"${(item.item_title || '').replace(/"/g, '""')}"`,
      `"${(item.item_description || '').replace(/"/g, '""')}"`,
      item.required_flag ? 'Y' : 'N',
      item.allow_multiple_files ? 'Y' : 'N',
      item.item_status || 'REQUESTED',
    ].join(',')
  )
  const content = [headers, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
