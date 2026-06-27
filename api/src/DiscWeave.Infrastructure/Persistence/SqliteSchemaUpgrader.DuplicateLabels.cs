using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    private const string DuplicateLabelsMergeUpgradeKey = "labels.merge_duplicate_normalized_names.v1";

    private sealed record LabelMergeCandidate(
        long RowId,
        string CollectionId,
        string LabelId,
        string Name);

    public static async Task EnsureDuplicateLabelsMergedByNormalizedNameAsync(
        DbConnection connection,
        CancellationToken cancellationToken = default)
    {
        bool shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            if (await HasSchemaUpgradeRunAsync(connection, DuplicateLabelsMergeUpgradeKey, cancellationToken))
            {
                return;
            }

            await using DbTransaction transaction = await connection.BeginTransactionAsync(cancellationToken);
            IReadOnlyList<LabelMergeCandidate> labels = await LoadLabelMergeCandidatesAsync(connection, transaction, cancellationToken);
            foreach (IGrouping<string, LabelMergeCandidate> group in labels.GroupBy(label => $"{label.CollectionId}\u001f{NormalizeLabelName(label.Name)}"))
            {
                LabelMergeCandidate canonical = group.OrderBy(label => label.RowId).First();
                foreach (LabelMergeCandidate duplicate in group.Where(label => label.LabelId != canonical.LabelId))
                {
                    await MergeDuplicateLabelAsync(connection, transaction, canonical, duplicate, cancellationToken);
                }
            }

            await transaction.CommitAsync(cancellationToken);
            await MarkSchemaUpgradeRunAsync(connection, DuplicateLabelsMergeUpgradeKey, cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task<IReadOnlyList<LabelMergeCandidate>> LoadLabelMergeCandidatesAsync(
        DbConnection connection,
        DbTransaction transaction,
        CancellationToken cancellationToken)
    {
        var labels = new List<LabelMergeCandidate>();
        await using DbCommand command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT id, collection_id, label_id, name
            FROM labels
            ORDER BY collection_id, id;
            """;
        await using DbDataReader reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            labels.Add(new LabelMergeCandidate(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3)));
        }

        return labels;
    }

    private static async Task MergeDuplicateLabelAsync(
        DbConnection connection,
        DbTransaction transaction,
        LabelMergeCandidate canonical,
        LabelMergeCandidate duplicate,
        CancellationToken cancellationToken)
    {
        await ExecuteLabelMergeCommandAsync(
            connection,
            transaction,
            """
            DELETE FROM rating_values
            WHERE collection_id = $collectionId
              AND target_type = 'label'
              AND target_label_id = $duplicateLabelId
              AND EXISTS (
                  SELECT 1
                  FROM rating_values existing
                  WHERE existing.collection_id = rating_values.collection_id
                    AND existing.criterion_id = rating_values.criterion_id
                    AND existing.target_type = 'label'
                    AND existing.target_label_id = $canonicalLabelId
              );
            """,
            canonical,
            duplicate,
            cancellationToken);
        await ExecuteLabelMergeCommandAsync(
            connection,
            transaction,
            """
            UPDATE rating_values
            SET target_label_id = $canonicalLabelId
            WHERE collection_id = $collectionId
              AND target_type = 'label'
              AND target_label_id = $duplicateLabelId;
            """,
            canonical,
            duplicate,
            cancellationToken);
        await ExecuteLabelMergeCommandAsync(
            connection,
            transaction,
            """
            UPDATE release_labels
            SET label_id = $canonicalLabelId
            WHERE collection_id = $collectionId
              AND label_id = $duplicateLabelId;
            """,
            canonical,
            duplicate,
            cancellationToken);
        await ExecuteLabelMergeCommandAsync(
            connection,
            transaction,
            """
            UPDATE releases
            SET label_id = $canonicalLabelId
            WHERE collection_id = $collectionId
              AND label_id = $duplicateLabelId;
            """,
            canonical,
            duplicate,
            cancellationToken);
        await ExecuteLabelMergeCommandAsync(
            connection,
            transaction,
            """
            DELETE FROM labels
            WHERE collection_id = $collectionId
              AND label_id = $duplicateLabelId;
            """,
            canonical,
            duplicate,
            cancellationToken);
    }

    private static async Task ExecuteLabelMergeCommandAsync(
        DbConnection connection,
        DbTransaction transaction,
        string commandText,
        LabelMergeCandidate canonical,
        LabelMergeCandidate duplicate,
        CancellationToken cancellationToken)
    {
        await using DbCommand command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = commandText;
        AddParameter(command, "$collectionId", canonical.CollectionId);
        AddParameter(command, "$canonicalLabelId", canonical.LabelId);
        AddParameter(command, "$duplicateLabelId", duplicate.LabelId);
        _ = await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        DbParameter parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        _ = command.Parameters.Add(parameter);
    }

    private static string NormalizeLabelName(string value)
    {
        return string.Join(' ', value.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
