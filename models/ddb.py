__author__ = 'nihil'

budb = DAL('sqlite://backup.sqlite')

debug = True
from gluon import current

auth.enable_record_versioning(db,archive_db=budb,archive_names='%(tablename)s')
from nutils import cached

@cached
def resolve_username(id, format_string = '%(first_name)s %(last_name)s'):
    user = db.auth_user[id]
    if user:
        return format_string % user
    return T('nobody')

base_table = db.Table(db,'tabella_base',
    Field('name',length=100, requires=IS_NOT_EMPTY(), label=T('name'), comment='nome dell\'utente'),
    Field('title',length=200, label=T('title')),
    Field('created_by', db.auth_user, required=True, default=lambda : current.globalenv['auth'].user.id, readable=False,writable=False, label = T('created by')),
    Field('created_on', 'datetime', default=lambda : current.request.now, readable=False,writable=False, label= T('created on')),
    Field('updated_by', db.auth_user, required=True, compute= lambda x : current.globalenv['auth'].user.id, default=lambda : current.globalenv['auth'].user.id, readable=False,writable=False, label=T('updated by')),
    Field('updated_on', 'datetime', compute=lambda x: current.request.now, default=lambda : current.request.now, readable=False,writable=False, label=T('updated on')),
)

db.define_table(
    'person',
    base_table,
    Field('first_name',length=12,label='Nome', requires=IS_NOT_EMPTY()),
    Field('last_name',length=12,label='Cognome', requires=IS_NOT_EMPTY()),
    Field('born','date',label='Data di nascita'),
    represents='%(first_name)s %(last_name)s',
)

db.define_table('pet',
    Field('name',length=20,label=T('pet name')),
    Field('pet_owner',db.person,label=T('owner'),requires=IS_IN_DB(db,db.person.id,'%(first_name)s %(last_name)s')),
)

from plugin_angular import TableResource
TableResource(db.person)
TableResource(db.pet)