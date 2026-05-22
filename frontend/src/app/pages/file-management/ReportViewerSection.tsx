import {
  Eye,
} from "lucide-react";

import type {
  CsvMetadataImportReportResponse,
  DuplicateActionResponse,
  FileOrganizationReportResponse,
  ReportFileResponse,
} from "../../../types/api";
import {
  DisclosureSection,
} from "../../components/common";
import {
  formatJson,
  reportSummary,
} from "./fileManagementUtils";

export function ReportViewerSection({
  reportPath,
  setReportPath,
  fileOrganizationReport,
  metadataCsvImportReport,
  duplicateActionResult,
  reportFile,
  onReadReportFile,
}: {
  reportPath: string;
  setReportPath: (value: string) => void;
  fileOrganizationReport: FileOrganizationReportResponse | null;
  metadataCsvImportReport: CsvMetadataImportReportResponse | null;
  duplicateActionResult: DuplicateActionResponse | null;
  reportFile: ReportFileResponse | null;
  onReadReportFile: (reportPath: string) => void | Promise<void>;
}) {
  return (
    <DisclosureSection title="Report Viewer" description="Open JSON reports from CSV imports, file organization, duplicate review, or AutoDJ profile comparison">
      <div className="grid gap-4 text-sm text-neutral-200">
        <label className="grid gap-2">
          <span className="text-xs uppercase text-muted">Report Path</span>
          <input
            className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
            value={reportPath}
            placeholder="Paste a FLAC Cafe JSON report path"
            onChange={(event) => setReportPath(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" onClick={() => void onReadReportFile(reportPath)}>
            <Eye size={15} />
            View Report
          </button>
          {fileOrganizationReport?.report_path && (
            <button className="secondary-button" type="button" onClick={() => {
              setReportPath(fileOrganizationReport.report_path);
              void onReadReportFile(fileOrganizationReport.report_path);
            }}>
              File Moves
            </button>
          )}
          {metadataCsvImportReport?.report_path && (
            <button className="secondary-button" type="button" onClick={() => {
              setReportPath(metadataCsvImportReport.report_path);
              void onReadReportFile(metadataCsvImportReport.report_path);
            }}>
              CSV Dry Run
            </button>
          )}
          {duplicateActionResult?.report_path && (
            <button className="secondary-button" type="button" onClick={() => {
              setReportPath(duplicateActionResult.report_path ?? "");
              if (duplicateActionResult.report_path) {
                void onReadReportFile(duplicateActionResult.report_path);
              }
            }}>
              Duplicates
            </button>
          )}
        </div>
        {reportFile && (
          <div className="rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-neutral-200">{reportFile.report_path}</div>
                <div className="text-muted">
                  {reportFile.exists
                    ? `${reportFile.size_bytes.toLocaleString()} bytes${reportFile.modified_at ? `, ${new Date(reportFile.modified_at).toLocaleString()}` : ""}`
                    : reportFile.error ?? "Report not found"}
                </div>
              </div>
              {reportFile.truncated && <span className="rounded border border-ember/40 px-2 py-1 text-ember">truncated</span>}
            </div>
            {reportFile.parsed_json !== null && (
              <div className="mb-2 rounded bg-panel px-2 py-1.5 text-muted">{reportSummary(reportFile.parsed_json)}</div>
            )}
            {reportFile.error && <div className="mb-2 text-ember">{reportFile.error}</div>}
            <pre className="max-h-96 overflow-auto rounded bg-panel p-3 font-mono text-[11px] leading-5 text-muted">
              {reportFile.parsed_json !== null ? formatJson(reportFile.parsed_json) : reportFile.raw_text ?? ""}
            </pre>
          </div>
        )}
      </div>
    </DisclosureSection>
  );
}
