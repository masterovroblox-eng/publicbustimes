from datetime import datetime
from zoneinfo import ZoneInfo

from django.contrib.gis.geos import GEOSGeometry

from busstops.models import Operator
from ..import_live_vehicles import ImportLiveVehiclesCommand
from ...models import VehicleLocation, VehicleJourney


def hyphenate(reg: str) -> str:
    i = 0
    while i < len(reg) and reg[i].isdigit():
        i += 1
    j = i
    while j < len(reg) and reg[j].isalpha():
        j += 1
    return f"{reg[:i]}-{reg[i:j]}-{reg[j:]}"


class Command(ImportLiveVehiclesCommand):
    source_name = vehicle_code_scheme = "Swords Express"
    operator = "Swords Express"
    url = "https://www.swordsexpress.com/app/themes/swordsexpress/resources/assets/scripts/latlong.php"

    def do_source(self):
        self.operator = Operator.objects.get(name=self.source_name)
        self.tzinfo = ZoneInfo("Europe/Dublin")
        super().do_source()

    def get_datetime(self, item: list):
        if len(item) >= 3:
            return datetime.fromisoformat(item[3]).replace(tzinfo=self.tzinfo)

    @staticmethod
    def get_vehicle_identity(item: list):
        return item[0]

    @staticmethod
    def get_journey_identity(item):
        return

    @staticmethod
    def get_item_identity(item):
        return item

    def get_vehicle(self, item):
        defaults = {
            "reg": hyphenate(item[0]),
            "source": self.source,
        }
        return self.vehicles.get_or_create(
            defaults, operator=self.operator, code=item[0]
        )

    def get_journey(self, item, _):
        journey = VehicleJourney()
        return journey

    def create_vehicle_location(self, item):
        if len(item) >= 3:
            return VehicleLocation(latlong=GEOSGeometry(f"POINT({item[2]} {item[1]})"))
