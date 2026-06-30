using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class TrackStackSettingsConfiguration : IEntityTypeConfiguration<TrackStackSettings>
{
    public void Configure(EntityTypeBuilder<TrackStackSettings> builder)
    {
        _ = builder.ToTable("track_stack_settings");

        _ = builder.Ignore(settings => settings.Id);

        _ = builder.HasKey(settings => settings.CollectionId);

        _ = builder.Property(settings => settings.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.Property<string>("_defaultRelationTypeCodes")
            .HasColumnName("default_relation_type_codes")
            .HasMaxLength(512)
            .IsRequired();

        _ = builder.HasOne<MusicCollection>()
            .WithOne()
            .HasForeignKey<TrackStackSettings>(settings => settings.CollectionId)
            .HasPrincipalKey<MusicCollection>(collection => collection.Id)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
