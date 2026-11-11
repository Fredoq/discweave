using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace DiscWeave.Api.Tests;

// Inject failures only after compatibility validation and within the operation's
// own transaction. The temporary trigger is rolled back with the failed save.
internal sealed class TransactionalFailureTriggerInterceptor : DbCommandInterceptor
{
    private readonly string _statement;
    private readonly string _trigger;

    public TransactionalFailureTriggerInterceptor(string statement, string trigger)
    {
        _statement = statement;
        _trigger = trigger;
    }

    public bool Injected { get; private set; }
    public bool FailureObserved { get; private set; }

    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        await InjectAsync(command, cancellationToken);
        return result;
    }

    public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        await InjectAsync(command, cancellationToken);
        return result;
    }

    public override Task CommandFailedAsync(DbCommand command, CommandErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        if (Injected && command.CommandText.Contains(_statement, StringComparison.Ordinal))
        {
            FailureObserved = true;
        }

        return Task.CompletedTask;
    }

    private async Task InjectAsync(DbCommand command, CancellationToken cancellationToken)
    {
        if (Injected || !command.CommandText.Contains(_statement, StringComparison.Ordinal))
        {
            return;
        }

        Assert.NotNull(command.Transaction);
        Assert.NotNull(command.Connection);
        using DbCommand injection = command.Connection.CreateCommand();
        injection.Transaction = command.Transaction;
        injection.CommandText = _trigger;
        _ = await injection.ExecuteNonQueryAsync(cancellationToken);
        Injected = true;
    }
}
