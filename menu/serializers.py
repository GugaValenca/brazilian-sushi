from rest_framework import serializers

from .models import Category, MenuItem, MenuOption, MenuOptionGroup


class MenuOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuOption
        fields = ("id", "name", "price_delta", "is_default")


class MenuOptionGroupSerializer(serializers.ModelSerializer):
    options = MenuOptionSerializer(many=True, read_only=True)

    class Meta:
        model = MenuOptionGroup
        fields = ("id", "name", "required", "min_select", "max_select", "options")


class MenuItemSerializer(serializers.ModelSerializer):
    option_groups = MenuOptionGroupSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = MenuItem
        fields = (
            "id",
            "category",
            "category_name",
            "name",
            "slug",
            "short_description",
            "description",
            "price",
            "image",
            "spicy",
            "vegetarian",
            "featured",
            "allergens",
            "calories",
            "availability",
            "option_groups",
        )


class CategorySerializer(serializers.ModelSerializer):
    # Not a plain nested serializer: hidden items must be excluded for
    # non-staff viewers here too, or they leak through
    # GET /api/menu/categories/ even though MenuItemViewSet correctly hides
    # them on GET /api/menu/items/.
    items = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "description", "sort_order", "items")

    def get_items(self, obj):
        request = self.context.get("request")
        queryset = obj.items.select_related("category").prefetch_related("option_groups__options")
        if not (request and request.user and request.user.is_staff):
            queryset = queryset.exclude(availability=MenuItem.Availability.HIDDEN)
        return MenuItemSerializer(queryset, many=True, context=self.context).data


class AdminCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "description", "sort_order")


class AdminMenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = (
            "id",
            "category",
            "name",
            "slug",
            "short_description",
            "description",
            "price",
            "image",
            "spicy",
            "vegetarian",
            "featured",
            "allergens",
            "calories",
            "availability",
        )


class AdminMenuOptionGroupSerializer(serializers.ModelSerializer):
    """MenuOptionGroupSerializer (above) is the read-only, nested-under-a-menu-item
    shape used by the public menu. This is the standalone, writable shape the
    admin's option-group management screen needs -- previously there was no
    API surface for this at all, only Django-admin inline editing."""

    class Meta:
        model = MenuOptionGroup
        fields = ("id", "menu_item", "name", "required", "min_select", "max_select")


class AdminMenuOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuOption
        fields = ("id", "group", "name", "price_delta", "is_default")
