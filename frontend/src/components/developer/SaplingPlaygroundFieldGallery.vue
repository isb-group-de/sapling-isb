<template>
  <v-row>
    <v-col cols="12" md="6">
      <SaplingPlaygroundCard :title="t('playground.textFields')">
        <v-row>
          <v-col cols="12" sm="6">
            <SaplingShortTextField
              v-model="shortTextFieldValue"
              :label="t('playground.shortTextField')"
              :disabled="false"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <SaplingLongTextField
              v-model="longTextFieldValue"
              :label="t('playground.longTextField')"
              :disabled="false"
            />
          </v-col>
        </v-row>
      </SaplingPlaygroundCard>

      <SaplingPlaygroundCard :title="t('playground.markdownField')">
        <SaplingMarkdownField
          v-model="markdownFieldValue"
          :label="t('playground.markdownField')"
          :rows="8"
          :show-preview="true"
        />
      </SaplingPlaygroundCard>

      <SaplingPlaygroundCard :title="t('playground.contactFields')">
        <v-row>
          <v-col cols="12" sm="4">
            <SaplingPhoneField
              v-model="phoneModel"
              :label="t('playground.phoneField')"
              :disabled="false"
              :placeholder="t('playground.phonePlaceholder')"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <SaplingMailField
              v-model="mailModel"
              :label="t('playground.mailField')"
              :disabled="false"
              :placeholder="t('playground.mailPlaceholder')"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <SaplingLinkField
              v-model="linkModel"
              :label="t('playground.linkField')"
              :disabled="false"
              :placeholder="t('playground.linkPlaceholder')"
            />
          </v-col>
        </v-row>
      </SaplingPlaygroundCard>

      <SaplingPlaygroundCard :title="t('playground.otherFields')">
        <v-row>
          <v-col cols="12" sm="6">
            <SaplingBooleanField
              v-model="booleanFieldValue"
              :label="t('playground.booleanField')"
              :disabled="false"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <SaplingColorField
              v-model="colorFieldValue"
              :label="t('playground.colorField')"
              :disabled="false"
            />
          </v-col>
        </v-row>
      </SaplingPlaygroundCard>
    </v-col>

    <v-col cols="12" md="6">
      <SaplingPlaygroundCard :title="t('playground.numbersAndDates')">
        <v-row>
          <v-col cols="12" sm="6">
            <SaplingNumberField
              v-model="numberFieldValue"
              :label="t('playground.numberField')"
              :disabled="false"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <SaplingDateTypeField
              v-model="dateTypeFieldValue"
              :label="t('playground.dateField')"
              :disabled="false"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <SaplingFieldMoney
              v-model="moneyFieldValue"
              :label="t('playground.moneyField')"
              :disabled="false"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <SaplingFieldPercent
              v-model="percentFieldValue"
              :label="t('playground.percentField')"
              :disabled="false"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6">
            <SaplingTimeField
              v-model="timeFieldValue"
              :label="t('playground.timeField')"
              :disabled="false"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <SaplingDateTimeField
              :label="t('playground.dateTimeField')"
              :date-value="dateTimeDateValue"
              :time-value="dateTimeTimeValue"
              :disabled="false"
              @update:date-value="dateTimeDateValue = $event"
              @update:time-value="dateTimeTimeValue = $event"
            />
          </v-col>
        </v-row>
      </SaplingPlaygroundCard>

      <SaplingPlaygroundCard :title="t('playground.iconSelection')">
        <SaplingIconField
          v-model="iconFieldValue"
          :label="t('playground.iconField')"
          :items="iconFieldItems"
          :disabled="false"
        />
      </SaplingPlaygroundCard>

      <SaplingPlaygroundCard :title="t('playground.selectField')">
        <v-row>
          <v-col cols="12" sm="6">
            <SaplingSelectField :label="t('playground.multiSelectField')" entity-handle="company" />
          </v-col>
          <v-col cols="12" sm="6">
            <SaplingSingleSelectField
              :label="t('playground.singleSelectField')"
              entity-handle="company"
            />
          </v-col>
          <v-col cols="12">
            <SaplingSingleSelectAddField
              :label="t('playground.singleSelectTransferField')"
              entity-handle="company"
            />
          </v-col>
          <v-col cols="12">
            <SaplingSelectAddField
              :label="t('playground.multiSelectTransferField')"
              entity-handle="company"
            />
          </v-col>
        </v-row>
      </SaplingPlaygroundCard>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingBooleanField from '@/components/dialog/fields/SaplingFieldBoolean.vue'
import SaplingColorField from '@/components/dialog/fields/SaplingFieldColor.vue'
import SaplingDateTimeField from '@/components/dialog/fields/SaplingFieldDateTime.vue'
import SaplingDateTypeField from '@/components/dialog/fields/SaplingFieldDateType.vue'
import SaplingFieldMoney from '@/components/dialog/fields/SaplingFieldMoney.vue'
import SaplingFieldPercent from '@/components/dialog/fields/SaplingFieldPercent.vue'
import SaplingIconField from '@/components/dialog/fields/SaplingFieldIcon.vue'
import SaplingLinkField from '@/components/dialog/fields/SaplingFieldLink.vue'
import SaplingLongTextField from '@/components/dialog/fields/SaplingFieldLongText.vue'
import SaplingMailField from '@/components/dialog/fields/SaplingFieldMail.vue'
import SaplingMarkdownField from '@/components/dialog/fields/SaplingFieldMarkdown.vue'
import SaplingNumberField from '@/components/dialog/fields/SaplingFieldNumber.vue'
import SaplingPhoneField from '@/components/dialog/fields/SaplingFieldPhone.vue'
import SaplingShortTextField from '@/components/dialog/fields/SaplingFieldShortText.vue'
import SaplingSingleSelectAddField from '@/components/dialog/fields/SaplingFieldSingleSelectAdd.vue'
import SaplingSingleSelectField from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
import SaplingTimeField from '@/components/dialog/fields/SaplingFieldTime.vue'
import SaplingPlaygroundCard from './SaplingPlaygroundCard.vue'
import { useSaplingPlaygroundFields } from '@/composables/developer/useSaplingPlaygroundFields'

const SaplingSelectAddField = defineAsyncComponent(
  () => import('@/components/dialog/fields/SaplingFieldSelectAdd.vue'),
)
const SaplingSelectField = defineAsyncComponent(
  () => import('@/components/dialog/fields/SaplingFieldSelect.vue'),
)

const props = defineProps<{
  phone: string
  mail: string
  link: string
}>()

const emit = defineEmits<{
  'update:phone': [value: string]
  'update:mail': [value: string]
  'update:link': [value: string]
}>()

const { t } = useI18n()
const phoneModel = computed({ get: () => props.phone, set: (value) => emit('update:phone', value) })
const mailModel = computed({ get: () => props.mail, set: (value) => emit('update:mail', value) })
const linkModel = computed({ get: () => props.link, set: (value) => emit('update:link', value) })

const {
  booleanFieldValue,
  colorFieldValue,
  shortTextFieldValue,
  longTextFieldValue,
  numberFieldValue,
  moneyFieldValue,
  percentFieldValue,
  dateTypeFieldValue,
  timeFieldValue,
  dateTimeDateValue,
  dateTimeTimeValue,
  markdownFieldValue,
  iconFieldItems,
  iconFieldValue,
} = useSaplingPlaygroundFields()
</script>
