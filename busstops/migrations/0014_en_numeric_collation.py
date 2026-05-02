from django.contrib.postgres.operations import CreateCollation
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('busstops', '0013_stoppoint_description_stoppoint_notes_and_more'),
    ]

    operations = [
        CreateCollation(
            'en_numeric',
            provider='icu',
            locale='en-u-kn-true',
            deterministic=False,
        ),
    ]
