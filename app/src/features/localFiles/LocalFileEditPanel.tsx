import { Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { loadNamingProfiles, type NamingProfile } from '../catalog/catalogApi'
import {
  catalogFailureMessage,
  partialApplyError,
  partialApplyStatus,
  reconcileCatalogFiles,
} from './localFileEditApplyResult'
import type { LocalEditableFile, LocalEditTags } from './localFileEditModel'
import {
  applyHelpText,
  applyNamingProfile,
  commonDirectory,
  directoryName,
  errorMessage,
  fileName,
  hasTagValues,
  initialInspectionState,
  joinPath,
  mergePreviewRows,
  normalizePath,
  normalizeTagDraft,
  relativePath,
  tagChangesByDraftId,
  toDraft,
} from './localFileEditHelpers'
import {
  ModeTabs,
  NamingProfileToolbar,
  ReleaseBatchEditor,
  SingleFileEditor,
} from './LocalFileNameEditor'
import { TagEditMode } from './LocalFileTagEditor'
import type {
  InspectState,
  LocalEditableFileDraft,
  LocalEditMode,
  LocalEditPreviewResult,
  StagedLocalEdit,
} from './localFileEditTypes'
import './local-files.css'

type LocalFileEditPanelProps = {
  files: LocalEditableFile[]
  onApplied?: () => void
  onClose: () => void
  onStage?: (edits: StagedLocalEdit[]) => void
}

type LocalEditApplyFileRequest = {
  localAudioFileId: string
  currentPath: string
  targetPath: string
  tags?: LocalEditTags
}

export function LocalFileEditPanel({
  files,
  onApplied,
  onClose,
  onStage,
}: Readonly<LocalFileEditPanelProps>) {
  const [activeMode, setActiveMode] = useState<LocalEditMode>('fileNames')
  const [drafts, setDrafts] = useState<LocalEditableFileDraft[]>(() =>
    files.map(toDraft),
  )
  const [inspections, setInspections] = useState<Record<string, InspectState>>(
    () => initialInspectionState(files),
  )
  const [validation, setValidation] = useState<LocalEditPreviewResult | null>(
    null,
  )
  const [selectedTagRowId, setSelectedTagRowId] = useState(
    files[0]?.rowId ?? '',
  )
  const [profiles, setProfiles] = useState<NamingProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const bridge = window.discweaveDesktop?.localEdits

  useEffect(() => {
    if (!bridge) {
      return
    }

    let isCancelled = false
    for (const file of files) {
      bridge
        .inspect({
          localAudioFileId: file.localAudioFileId,
          path: file.currentPath,
        })
        .then((result) => {
          if (!isCancelled) {
            setInspections((current) => ({
              ...current,
              [file.rowId]: { status: 'loaded', result },
            }))
          }
        })
        .catch((inspectError: unknown) => {
          if (!isCancelled) {
            setInspections((current) => ({
              ...current,
              [file.rowId]: {
                status: 'failed',
                message: errorMessage(inspectError, 'File inspection failed.'),
              },
            }))
          }
        })
    }

    return () => {
      isCancelled = true
    }
  }, [bridge, files])

  useEffect(() => {
    let isCancelled = false
    void loadNamingProfiles()
      .then((response) => {
        if (isCancelled) {
          return
        }

        const defaultProfile =
          response.items.find((profile) => profile.isDefault) ??
          response.items[0]
        // A restored staged plan keeps its targets instead of the default profile.
        const isRestoredPlan = files.some((file) => file.targetTags)
        setProfiles(response.items)
        setSelectedProfileId(isRestoredPlan ? '' : (defaultProfile?.id ?? ''))
        if (defaultProfile && !isRestoredPlan) {
          setDrafts((currentDrafts) =>
            applyNamingProfile(
              currentDrafts,
              defaultProfile,
              initialInspectionState(currentDrafts),
            ),
          )
        }
      })
      .catch((loadError: unknown) => {
        if (!isCancelled) {
          setError(errorMessage(loadError, 'Naming profiles failed to load.'))
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setProfilesLoaded(true)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [files])

  // Staged tag diffs and default targets need inspections and profiles first.
  const isPreparing =
    !profilesLoaded ||
    Object.values(inspections).some((state) => state.status === 'loading')
  const selectedProfile = profiles.find(
    (profile) => profile.id === selectedProfileId,
  )
  const currentReleaseFolder = commonDirectory(
    drafts.map((draft) => directoryName(draft.currentPath)),
  )
  const targetReleaseFolder = commonDirectory(
    drafts.map((draft) => directoryName(draft.targetPath)),
  )
  const tagChangesByRowId = useMemo(
    () => tagChangesByDraftId(drafts, inspections),
    [drafts, inspections],
  )
  const proposedRows = mergePreviewRows(drafts, validation, tagChangesByRowId)
  const renameCount = proposedRows.filter((row) => row.rename).length
  const unchangedCount = proposedRows.length - renameCount
  const tagUpdateCount = drafts.filter((draft) =>
    hasTagValues(tagChangesByRowId.get(draft.rowId) ?? {}),
  ).length
  const tagUnchangedCount = drafts.length - tagUpdateCount
  const validationIssues = proposedRows.flatMap((row) =>
    row.issues.map((issue) => ({
      ...issue,
      rowId: row.rowId,
      localAudioFileId: row.localAudioFileId,
      title: row.title,
    })),
  )
  const actionableRequest = useMemo<{ files: LocalEditApplyFileRequest[] }>(
    () => ({
      files: drafts.flatMap((draft) =>
        activeMode === 'fileNames'
          ? renameRequest(draft)
          : tagRequest(draft, tagChangesByRowId),
      ),
    }),
    [activeMode, drafts, tagChangesByRowId],
  )

  const localEdits = bridge

  if (!localEdits) {
    return null
  }
  const localEditBridge = localEdits

  function applyProfile(profileId: string) {
    setSelectedProfileId(profileId)
    const profile = profiles.find((candidate) => candidate.id === profileId)
    if (!profile) {
      return
    }

    setDrafts((currentDrafts) =>
      applyNamingProfile(currentDrafts, profile, inspections),
    )
    clearValidationState()
  }

  function handleModeChange(mode: LocalEditMode) {
    setActiveMode(mode)
    clearValidationState()
  }

  async function handleApply() {
    if (onStage) {
      const edits = stagedEdits(drafts, tagChangesByRowId)
      onStage(edits)
      setStatus(`Saved for confirm: ${edits.length} files will change.`)
      return
    }

    setIsPending(true)
    setError('')
    setStatus('')
    setValidation(null)

    try {
      if (actionableRequest.files.length === 0) {
        return
      }

      const result = await localEditBridge.apply(actionableRequest)
      const catalogFailures = await reconcileCatalogFiles(result.files)
      const appliedFilesByLocalAudioFileId = new Map(
        result.files.map((file) => [file.localAudioFileId, file]),
      )
      const appliedRequestsByLocalAudioFileId = new Map(
        actionableRequest.files.map((file) => [file.localAudioFileId, file]),
      )
      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) => {
          const appliedFile = appliedFilesByLocalAudioFileId.get(
            draft.localAudioFileId,
          )
          if (!appliedFile) {
            return draft
          }

          return {
            ...draft,
            currentPath: appliedFile.path,
            targetPath: appliedFile.path,
          }
        }),
      )
      setInspections((currentInspections) => {
        const nextInspections = { ...currentInspections }
        for (const appliedFile of result.files) {
          const appliedRequest = appliedRequestsByLocalAudioFileId.get(
            appliedFile.localAudioFileId,
          )
          const appliedDrafts = drafts.filter(
            (draft) => draft.localAudioFileId === appliedFile.localAudioFileId,
          )
          for (const appliedDraft of appliedDrafts) {
            const currentInspection = currentInspections[appliedDraft.rowId]
            if (currentInspection?.status !== 'loaded') {
              continue
            }

            nextInspections[appliedDraft.rowId] = {
              status: 'loaded',
              result: {
                ...currentInspection.result,
                path: appliedFile.path,
                format: appliedFile.format,
                sizeBytes: appliedFile.sizeBytes,
                lastModifiedAt: appliedFile.lastModifiedAt,
                tags: appliedRequest?.tags
                  ? normalizeTagDraft(appliedDraft.targetTags)
                  : currentInspection.result.tags,
              },
            }
          }
        }

        return nextInspections
      })

      if (!result.applied) {
        setValidation({ ok: false, changes: result.changes ?? [] })
        setStatus(partialApplyStatus(result, catalogFailures.length))
        setError(partialApplyError(result, catalogFailures.length))
        return
      }

      if (catalogFailures.length > 0) {
        setStatus(
          result.operationLogPath
            ? `Local files changed. Operation log: ${result.operationLogPath}`
            : 'Local files changed.',
        )
        setError(catalogFailureMessage(catalogFailures.length))
        return
      }

      setStatus(
        result.operationLogPath
          ? `Local edit applied. Operation log: ${result.operationLogPath}`
          : 'Local edit applied.',
      )
      onApplied?.()
    } catch (applyError) {
      setError(errorMessage(applyError, 'Apply failed.'))
    } finally {
      setIsPending(false)
    }
  }

  function handleTargetPathChange(rowId: string, targetPath: string) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        currentDraft.rowId === rowId
          ? { ...currentDraft, targetPath }
          : currentDraft,
      ),
    )
    setValidation(null)
  }

  function handleTargetTagsChange(rowId: string, targetTags: LocalEditTags) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        currentDraft.rowId === rowId
          ? { ...currentDraft, targetTags }
          : currentDraft,
      ),
    )
    clearValidationState()
  }

  function handleAutofillTags(rowId?: string) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        !rowId || currentDraft.rowId === rowId
          ? {
              ...currentDraft,
              targetTags: normalizeTagDraft(currentDraft.tags),
            }
          : currentDraft,
      ),
    )
    clearValidationState()
  }

  function handleReleaseFolderChange(nextReleaseFolder: string) {
    setDrafts((currentDrafts) => {
      const currentTargetRoot = commonDirectory(
        currentDrafts.map((draft) => directoryName(draft.targetPath)),
      )

      return currentDrafts.map((draft) => {
        const targetDirectory = directoryName(draft.targetPath)
        const targetFileName = fileName(draft.targetPath)
        const relativeDirectory = relativePath(
          currentTargetRoot,
          targetDirectory,
        )

        return {
          ...draft,
          targetPath: joinPath(
            nextReleaseFolder,
            relativeDirectory,
            targetFileName,
          ),
        }
      })
    })
    setValidation(null)
  }

  function clearValidationState() {
    setValidation(null)
    setStatus('')
    setError('')
  }

  return (
    <section
      className="panel local-file-edit-panel"
      aria-label="Local file editor"
    >
      <div className="panel-heading local-file-edit-heading">
        <div>
          <h2>Local file editor</h2>
          <p>{files.length === 1 ? files[0].title : `${files.length} files`}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close local file editor"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <ModeTabs activeMode={activeMode} onModeChange={handleModeChange} />

      {activeMode === 'fileNames' ? (
        <>
          <NamingProfileToolbar
            profiles={profiles}
            selectedProfile={selectedProfile}
            selectedProfileId={selectedProfileId}
            onProfileChange={applyProfile}
          />
          {drafts.length > 1 ? (
            <ReleaseBatchEditor
              currentReleaseFolder={currentReleaseFolder}
              rows={proposedRows}
              targetReleaseFolder={targetReleaseFolder}
              unchangedCount={unchangedCount}
              validationIssues={validationIssues}
              validationState={validation}
              renameCount={renameCount}
              onTargetReleaseFolderChange={handleReleaseFolderChange}
            />
          ) : (
            <SingleFileEditor
              draft={drafts[0]}
              inspection={inspections[drafts[0]?.rowId]}
              rows={proposedRows}
              validationIssues={validationIssues}
              validationState={validation}
              onTargetPathChange={handleTargetPathChange}
            />
          )}
        </>
      ) : (
        <TagEditMode
          drafts={drafts}
          inspections={inspections}
          selectedRowId={selectedTagRowId}
          tagChangesByRowId={tagChangesByRowId}
          tagUnchangedCount={tagUnchangedCount}
          tagUpdateCount={tagUpdateCount}
          onAutofillTags={handleAutofillTags}
          onSelectedRowChange={setSelectedTagRowId}
          onTargetTagsChange={handleTargetTagsChange}
        />
      )}
      {status ? <output>{status}</output> : null}
      {error ? <p role="alert">{error}</p> : null}

      <div className="local-file-edit-actions">
        <p>
          {onStage
            ? 'File names and tags are written after the import is confirmed.'
            : applyHelpText(activeMode)}
        </p>
        <button
          className="button button-primary"
          disabled={
            isPending ||
            (onStage ? isPreparing : actionableRequest.files.length === 0)
          }
          type="button"
          onClick={() => {
            void handleApply()
          }}
        >
          <Save size={16} />
          {applyButtonLabel(Boolean(onStage), activeMode)}
        </button>
      </div>
    </section>
  )
}

function renameRequest(draft: LocalEditableFileDraft) {
  const rename =
    normalizePath(draft.currentPath) !== normalizePath(draft.targetPath)

  return rename
    ? [
        {
          localAudioFileId: draft.localAudioFileId,
          currentPath: draft.currentPath,
          targetPath: draft.targetPath,
        },
      ]
    : []
}

function tagRequest(
  draft: LocalEditableFileDraft,
  tagChangesByRowId: Map<string, LocalEditTags>,
) {
  const tagChanges = tagChangesByRowId.get(draft.rowId) ?? {}

  return hasTagValues(tagChanges)
    ? [
        {
          localAudioFileId: draft.localAudioFileId,
          currentPath: draft.currentPath,
          targetPath: draft.currentPath,
          tags: tagChanges,
        },
      ]
    : []
}

function stagedEdits(
  drafts: LocalEditableFileDraft[],
  tagChangesByRowId: Map<string, LocalEditTags>,
): StagedLocalEdit[] {
  return drafts
    .map((draft) => ({
      currentPath: draft.currentPath,
      targetPath: draft.targetPath,
      targetTags: draft.targetTags,
      tagChanges: tagChangesByRowId.get(draft.rowId) ?? {},
    }))
    .filter(
      (edit) =>
        normalizePath(edit.currentPath) !== normalizePath(edit.targetPath) ||
        hasTagValues(edit.tagChanges),
    )
}

function applyButtonLabel(isStaging: boolean, mode: LocalEditMode) {
  if (isStaging) {
    return 'Save for confirm'
  }

  return mode === 'fileNames' ? 'Apply file names' : 'Apply tags'
}
