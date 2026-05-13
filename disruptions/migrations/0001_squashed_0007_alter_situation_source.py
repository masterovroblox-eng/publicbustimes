import disruptions.models
import django.contrib.postgres.fields.ranges
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    replaces = [('disruptions', '0001_squashed_0002_rename_situation_current_publication_window_disruptions_current_cfec06_idx_and_more'), ('disruptions', '0003_alter_situation_created_and_more'), ('disruptions', '0004_situation_show_summary_alter_situation_summary'), ('disruptions', '0005_rename_created_situation_created_at_and_more'), ('disruptions', '0006_affectedjourney_call'), ('disruptions', '0007_alter_situation_source')]

    initial = True

    dependencies = [
        ('busstops', '0001_initial'),
        ('busstops', '0002_initial'),
        ('busstops', '0003_alter_stopcode_source'),
        ('busstops', '0008_datasource_description'),
        ('bustimes', '0007_version_route_version'),
    ]

    operations = [
        migrations.CreateModel(
            name='Situation',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('situation_number', models.CharField(blank=True, max_length=36)),
                ('reason', models.CharField(blank=True, max_length=25)),
                ('summary', models.CharField(blank=True, max_length=255)),
                ('text', models.TextField(blank=True)),
                ('data', models.TextField(blank=True)),
                ('created', models.DateTimeField()),
                ('publication_window', django.contrib.postgres.fields.ranges.DateTimeRangeField()),
                ('current', models.BooleanField(default=True)),
                ('source', models.ForeignKey(limit_choices_to={'name__in': ('Ito World', 'TfE', 'TfL', 'Transport for the North', 'Transport for West Midlands', 'bustimes.org')}, on_delete=django.db.models.deletion.CASCADE, to='busstops.datasource')),
            ],
        ),
        migrations.CreateModel(
            name='ValidityPeriod',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period', django.contrib.postgres.fields.ranges.DateTimeRangeField()),
                ('situation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='disruptions.situation')),
            ],
        ),
        migrations.CreateModel(
            name='Link',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('url', models.URLField()),
                ('situation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='disruptions.situation')),
            ],
        ),
        migrations.CreateModel(
            name='Consequence',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField(blank=True)),
                ('data', models.TextField(blank=True)),
                ('operators', models.ManyToManyField(blank=True, to='busstops.operator')),
                ('services', models.ManyToManyField(blank=True, to='busstops.service')),
                ('situation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='disruptions.situation')),
                ('stops', models.ManyToManyField(blank=True, to='busstops.stoppoint')),
            ],
        ),
        migrations.AddIndex(
            model_name='situation',
            index=models.Index(fields=['current', 'publication_window'], name='disruptions_current_cfec06_idx'),
        ),
        migrations.AddField(
            model_name='situation',
            name='participant_ref',
            field=models.CharField(blank=True, max_length=36),
        ),
        migrations.AlterField(
            model_name='situation',
            name='source',
            field=models.ForeignKey(limit_choices_to={'name__in': ('bustimes.org', 'Bus Open Data Service', 'Ito World', 'TfL', 'Transport for the North')}, on_delete=django.db.models.deletion.CASCADE, to='busstops.datasource'),
        ),
        migrations.AddIndex(
            model_name='situation',
            index=models.Index(fields=['source', 'situation_number'], name='disruptions_source__e0ddcb_idx'),
        ),
        migrations.AlterField(
            model_name='situation',
            name='publication_window',
            field=django.contrib.postgres.fields.ranges.DateTimeRangeField(default=disruptions.models.from_now),
        ),
        migrations.AlterField(
            model_name='situation',
            name='source',
            field=models.ForeignKey(default=236, limit_choices_to={'name__in': ('bustimes.org', 'TfL', 'TfL disruptions', 'TfL statuses', 'BODS disruptions', 'BODS cancellations', 'Bus Open Data')}, on_delete=django.db.models.deletion.CASCADE, to='busstops.datasource'),
        ),
        migrations.AddField(
            model_name='situation',
            name='show_summary',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='situation',
            name='summary',
            field=models.CharField(blank=True, help_text='(title)', max_length=255),
        ),
        migrations.RenameField(
            model_name='situation',
            old_name='created',
            new_name='created_at',
        ),
        migrations.AlterField(
            model_name='situation',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='situation',
            name='modified_at',
            field=models.DateTimeField(default=django.utils.timezone.now, null=True),
        ),
        migrations.CreateModel(
            name='AffectedJourney',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('origin_departure_time', models.DateTimeField(blank=True, null=True)),
                ('condition', models.CharField()),
                ('situation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='disruptions.situation')),
                ('trip', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='bustimes.trip')),
            ],
        ),
        migrations.CreateModel(
            name='Call',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('arrival_time', models.DateTimeField(blank=True, null=True)),
                ('departure_time', models.DateTimeField(blank=True, null=True)),
                ('condition', models.CharField()),
                ('order', models.PositiveSmallIntegerField()),
                ('journey', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='disruptions.affectedjourney')),
                ('stop_time', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='bustimes.stoptime')),
            ],
        ),
    ]
